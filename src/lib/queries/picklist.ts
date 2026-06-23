import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PicklistTier, TeamScore } from '@/lib/types';
import { scoutingKeys } from '@/lib/queries/scouting';

export const picklistKey = ['picklist'] as const;

export type PicklistTeam = {
  id: string;
  team_number: number;
  team_name: string | null;
  score: number;
  entry_count: number;
  tier: PicklistTier | null;
  notes: string | null;
  /** question_id -> yes-percent */
  capabilities: Record<string, number>;
};

export function usePicklist() {
  return useQuery({
    queryKey: picklistKey,
    queryFn: async (): Promise<PicklistTeam[]> => {
      const [scores, teams, caps] = await Promise.all([
        supabase.from('team_scores').select('*'),
        supabase.from('scouted_teams').select('id, picklist_tier, picklist_notes'),
        supabase.from('team_capability_scores').select('team_id, question_id, percent'),
      ]);
      if (scores.error) throw scores.error;
      if (teams.error) throw teams.error;
      if (caps.error) throw caps.error;

      const tierById = new Map<string, { tier: PicklistTier | null; notes: string | null }>();
      for (const t of teams.data ?? []) {
        tierById.set(t.id as string, {
          tier: (t.picklist_tier as PicklistTier | null) ?? null,
          notes: (t.picklist_notes as string | null) ?? null,
        });
      }

      const capsByTeam = new Map<string, Record<string, number>>();
      for (const c of caps.data ?? []) {
        const map = capsByTeam.get(c.team_id as string) ?? {};
        map[c.question_id as string] = Number(c.percent);
        capsByTeam.set(c.team_id as string, map);
      }

      return (scores.data as TeamScore[]).map((s) => ({
        id: s.team_id,
        team_number: s.team_number,
        team_name: s.team_name,
        score: s.score,
        entry_count: s.entry_count,
        tier: tierById.get(s.team_id)?.tier ?? null,
        notes: tierById.get(s.team_id)?.notes ?? null,
        capabilities: capsByTeam.get(s.team_id) ?? {},
      }));
    },
  });
}

function usePicklistMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: picklistKey });
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
    },
  });
}

export function useSetTier() {
  return usePicklistMutation<{ teamId: string; tier: PicklistTier | null }>(async ({ teamId, tier }) => {
    const { error } = await supabase.from('scouted_teams').update({ picklist_tier: tier }).eq('id', teamId);
    if (error) throw error;
  });
}

export function useSetPicklistNotes() {
  return usePicklistMutation<{ teamId: string; notes: string }>(async ({ teamId, notes }) => {
    const { error } = await supabase
      .from('scouted_teams')
      .update({ picklist_notes: notes || null })
      .eq('id', teamId);
    if (error) throw error;
  });
}
