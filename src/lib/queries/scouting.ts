import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoCapabilityQuestions,
  demoCreateQuestion,
  demoCurrentUserId,
  demoDeleteQuestion,
  demoSubmitPitEntry,
  demoTeamDetail,
  demoTeamScores,
  demoUpdateQuestion,
  isDemoMode,
} from '@/lib/demo';
import type {
  AnswerValue,
  CapabilityQuestion,
  PitAnswer,
  ScoutedTeam,
  TeamScore,
} from '@/lib/types';

export const scoutingKeys = {
  questions: (activeOnly: boolean) => ['capability_questions', activeOnly] as const,
  teamScores: ['team_scores'] as const,
  team: (id: string) => ['scouted_team', id] as const,
  teamEntries: (teamId: string) => ['team_entries', teamId] as const,
};

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

// ---- Reads ------------------------------------------------------------------

export function useCapabilityQuestions(activeOnly = true) {
  return useQuery({
    queryKey: scoutingKeys.questions(activeOnly),
    queryFn: async (): Promise<CapabilityQuestion[]> => {
      if (isDemoMode()) return demoCapabilityQuestions(activeOnly);
      let query = supabase
        .from('capability_questions')
        .select('*')
        .order('sort_order', { ascending: true });
      if (activeOnly) query = query.eq('active', true);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as CapabilityQuestion[];
    },
  });
}

export function useTeamScores() {
  return useQuery({
    queryKey: scoutingKeys.teamScores,
    queryFn: async (): Promise<TeamScore[]> => {
      if (isDemoMode()) return demoTeamScores();
      
      // TEMPORARY OVERRIDE: Fetch teams from active event in event_data
      const { data: activeEventPointer } = await supabase
        .from('event_data')
        .select('data')
        .eq('event_code', 'active_event')
        .maybeSingle();

      if (!activeEventPointer?.data?.eventCode) return [];

      const { data: eventData } = await supabase
        .from('event_data')
        .select('data')
        .eq('event_code', activeEventPointer.data.eventCode)
        .maybeSingle();

      const teams = eventData?.data?.teams || [];
      
      return teams.map((t: any) => ({
        team_id: String(t.team_number),
        team_number: t.team_number,
        team_name: t.team_name,
        score: 0
      })) as TeamScore[];
    },
  });
}

export type EntryWithDetails = {
  id: string;
  notes: string | null;
  created_at: string;
  scouter: { full_name: string | null; avatar_url: string | null } | null;
  answers: PitAnswer[];
};

export function useTeamDetail(teamId: string) {
  return useQuery({
    queryKey: scoutingKeys.team(teamId),
    enabled: !!teamId,
    queryFn: async () => {
      if (isDemoMode()) return demoTeamDetail(teamId);
      const [{ data: team, error: teamErr }, { data: entries, error: entryErr }] =
        await Promise.all([
          supabase.from('scouted_teams').select('*').eq('id', teamId).maybeSingle(),
          supabase
            .from('pit_scouting_entries')
            .select(
              'id, notes, created_at, scouter:profiles(full_name, avatar_url), answers:pit_scouting_answers(id, entry_id, question_id, answer)'
            )
            .eq('scouted_team_id', teamId)
            .order('created_at', { ascending: false }),
        ]);
      if (teamErr) throw teamErr;
      if (entryErr) throw entryErr;
      return {
        team: (team ?? null) as ScoutedTeam | null,
        entries: (entries ?? []) as unknown as EntryWithDetails[],
      };
    },
  });
}

// ---- Submit a pit scouting report ------------------------------------------

export type SubmitPitInput = {
  teamNumber: number;
  teamName?: string;
  notes?: string;
  answers: { questionId: string; answer: AnswerValue }[];
};

export function useSubmitPitEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SubmitPitInput): Promise<{ teamId: string }> => {
      if (isDemoMode()) return demoSubmitPitEntry(input);
      const uid = await currentUserId();

      // Find or create the team (without clobbering an existing name).
      const { data: existing, error: findErr } = await supabase
        .from('scouted_teams')
        .select('id, team_name')
        .eq('team_number', input.teamNumber)
        .maybeSingle();
      if (findErr) throw findErr;

      let teamId: string;
      if (existing) {
        teamId = existing.id as string;
        if (input.teamName && !existing.team_name) {
          await supabase.from('scouted_teams').update({ team_name: input.teamName }).eq('id', teamId);
        }
      } else {
        const { data: created, error: createErr } = await supabase
          .from('scouted_teams')
          .insert({ team_number: input.teamNumber, team_name: input.teamName ?? null, created_by: uid })
          .select('id')
          .single();
        if (createErr) throw createErr;
        teamId = created.id as string;
      }

      const { data: entry, error: entryErr } = await supabase
        .from('pit_scouting_entries')
        .insert({ scouted_team_id: teamId, scouter_id: uid, notes: input.notes ?? null })
        .select('id')
        .single();
      if (entryErr) throw entryErr;

      if (input.answers.length > 0) {
        const rows = input.answers.map((a) => ({
          entry_id: entry.id,
          question_id: a.questionId,
          answer: a.answer,
        }));
        const { error: ansErr } = await supabase.from('pit_scouting_answers').insert(rows);
        if (ansErr) throw ansErr;
      }

      return { teamId };
    },
    onSuccess: ({ teamId }) => {
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
      qc.invalidateQueries({ queryKey: scoutingKeys.team(teamId) });
    },
  });
}

// ---- Admin: manage capability questions ------------------------------------

function useQuestionMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['capability_questions'] });
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
    },
  });
}

export function useCreateQuestion() {
  return useQuestionMutation<{ prompt: string; category: string; weight: number; sort_order: number }>(
    async (vars) => {
      if (isDemoMode()) return demoCreateQuestion(vars);
      const { error } = await supabase.from('capability_questions').insert(vars);
      if (error) throw error;
    }
  );
}

export function useUpdateQuestion() {
  return useQuestionMutation<{ id: string } & Partial<CapabilityQuestion>>(async ({ id, ...patch }) => {
    if (isDemoMode()) return demoUpdateQuestion(id, patch);
    const { error } = await supabase.from('capability_questions').update(patch).eq('id', id);
    if (error) throw error;
  });
}

export function useDeleteQuestion() {
  return useQuestionMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteQuestion(id);
    const { error } = await supabase.from('capability_questions').delete().eq('id', id);
    if (error) throw error;
  });
}
