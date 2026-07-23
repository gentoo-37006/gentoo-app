import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoAssignScouter,
  demoAutoAssign,
  demoCurrentUserId,
  demoDeleteMatch,
  demoMatchDetail,
  demoMatches,
  demoMyAssignments,
  demoRemoveAssignment,
  demoSubmitMatchReport,
  demoUpsertMatches,
  isDemoMode,
} from '@/lib/demo';
import { notifyByFunctionalRole, notifyUsers } from '@/lib/notify';
import type { Match, MatchReport, ScoutingAssignment } from '@/lib/types';
import type { ParsedMatch } from '@/lib/csv';

export const matchKeys = {
  all: ['matches'] as const,
  mine: (uid?: string) => ['my_assignments', uid] as const,
  detail: (id: string) => ['match', id] as const,
};

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

export type AssignmentLite = Pick<
  ScoutingAssignment,
  'id' | 'scouter_id' | 'team_number' | 'status'
>;
export type MatchWithAssignments = Match & { assignments: AssignmentLite[] };

export function useMatches() {
  return useQuery({
    queryKey: matchKeys.all,
    queryFn: async (): Promise<MatchWithAssignments[]> => {
      if (isDemoMode()) return demoMatches();

      // 1. Fetch active event matches from JSON
      const { data: activeEventPointer } = await supabase
        .from('event_data')
        .select('data')
        .eq('event_code', 'active_event')
        .maybeSingle();

      const eventCode = activeEventPointer?.data?.eventCode;
      let eventMatches: any[] = [];
      
      if (eventCode) {
        const { data: eventData } = await supabase
          .from('event_data')
          .select('data')
          .eq('event_code', eventCode)
          .maybeSingle();
        eventMatches = eventData?.data?.matches || [];
      }

      // 2. Fetch DB matches to get UUIDs and assignments
      const { data, error } = await supabase
        .from('matches')
        .select('*, assignments:scouting_assignments(id, scouter_id, team_number, status)');
      if (error) throw error;
      
      const dbMatches = (data ?? []) as unknown as MatchWithAssignments[];
      const dbMatchMap = new Map(dbMatches.map(m => [m.match_number, m]));

      // 3. Construct the list using JSON as source of truth
      // If no active event synced yet, fallback to DB matches
      if (eventMatches.length === 0) {
        return dbMatches.sort((a, b) => a.match_number - b.match_number);
      }

      return eventMatches
        .sort((a, b) => a.match_number - b.match_number)
        .map((m, index) => {
          const dbMatch = dbMatchMap.get(m.match_number);
          return {
            id: dbMatch?.id || `match_${m.match_number}_${index}`,
            match_number: m.match_number,
            label: m.label,
            red1: m.red1,
            red2: m.red2,
            blue1: m.blue1,
            blue2: m.blue2,
            has_been_played: m.has_been_played,
            tournament_level: m.tournament_level,
            scheduled_time: m.scheduled_time ?? dbMatch?.scheduled_time ?? null,
            red_score: m.red_score,
            red_auto: m.red_auto,
            red_dc: m.red_dc,
            blue_score: m.blue_score,
            blue_auto: m.blue_auto,
            blue_dc: m.blue_dc,
            created_at: dbMatch?.created_at || new Date().toISOString(),
            assignments: dbMatch?.assignments || [],
          } as MatchWithAssignments;
        });
    },
  });
}

export type MyAssignment = ScoutingAssignment & { match: Match | null };

export function useMyAssignments(uid?: string) {
  return useQuery({
    queryKey: matchKeys.mine(uid),
    enabled: !!uid,
    queryFn: async (): Promise<MyAssignment[]> => {
      if (isDemoMode()) return demoMyAssignments(uid);
      const { data, error } = await supabase
        .from('scouting_assignments')
        .select('*, match:matches(*)')
        .eq('scouter_id', uid!)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as MyAssignment[];
    },
  });
}

export type AssignmentWithScouter = ScoutingAssignment & {
  scouter: { full_name: string | null; avatar_url: string | null } | null;
};

export function useMatchDetail(matchId: string) {
  return useQuery({
    queryKey: matchKeys.detail(matchId),
    enabled: !!matchId,
    queryFn: async () => {
      if (isDemoMode()) return demoMatchDetail(matchId);
      const [{ data: match, error: mErr }, { data: assignments, error: aErr }, { data: reports, error: rErr }] =
        await Promise.all([
          supabase.from('matches').select('*').eq('id', matchId).maybeSingle(),
          supabase
            .from('scouting_assignments')
            .select('*, scouter:profiles(full_name, avatar_url)')
            .eq('match_id', matchId),
          supabase.from('match_reports').select('*').eq('match_id', matchId).order('created_at'),
        ]);
      if (mErr) console.error(mErr)
      if (aErr) console.error(aErr)
      if (rErr) console.error(rErr)

      let finalMatch = (match ?? null) as Match | null;

      // Always pull score breakdown from event_data — the relational `matches` table
      // doesn't have these columns (no migration privileges), so event_data is the source of truth.
      const { data: pointer } = await supabase.from('event_data').select('data').eq('event_code', 'active_event').maybeSingle();
      if (pointer?.data?.eventCode) {
        const { data: eventData } = await supabase.from('event_data').select('data').eq('event_code', pointer.data.eventCode).maybeSingle();
        const eventMatches: any[] = eventData?.data?.matches || [];

        // Resolve match_number to look up in the JSON — works for both real UUIDs and mock IDs.
        const matchNum = finalMatch?.match_number
          ?? (matchId.startsWith('match_') ? parseInt(matchId.split('_')[1], 10) : null);

        const found = matchNum != null ? eventMatches.find((m: any) => m.match_number === matchNum) : null;

        if (found) {
          // if (!finalMatch) {
          //   // No DB row — build entirely from JSON
          //   finalMatch = {
          //     id: matchId,
          //     match_number: found.match_number,
          //     label: found.label || `Match ${found.match_number}`,
          //     red1: found.red1,
          //     red2: found.red2,
          //     blue1: found.blue1,
          //     blue2: found.blue2,
          //     created_at: new Date().toISOString(),
          //   };
          // }
          finalMatch = {
            id: matchId,
            match_number: found.match_number,
            label: found.label || `Match ${found.match_number}`,
            red1: found.red1,
            red2: found.red2,
            blue1: found.blue1,
            blue2: found.blue2,
            created_at: new Date().toISOString(),
            red_score: found.red_score ?? null,
            red_auto: found.red_auto ?? null,
            red_dc: found.red_dc ?? null,
            blue_score: found.blue_score ?? null,
            blue_auto: found.blue_auto ?? null,
            blue_dc: found.blue_dc ?? null,
            has_been_played: found.has_been_played ?? false,
            tournament_level: found.tournament_level ?? null,
            scheduled_time: found.scheduled_time ?? finalMatch?.scheduled_time ?? null,
          };
        }
      }

      return {
        match: finalMatch,
        assignments: (assignments ?? []) as unknown as AssignmentWithScouter[],
        reports: (reports ?? []) as MatchReport[],
      };
    },
  });
}

// ---- Mutations --------------------------------------------------------------

function useMatchMutation<TVars, TData = unknown>(fn: (vars: TVars) => Promise<TData>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.all });
      qc.invalidateQueries({ queryKey: ['my_assignments'] });
      qc.invalidateQueries({ queryKey: ['match'] });
    },
  });
}

export function useCreateMatch() {
  return useMatchMutation<{ match_number: number; red1?: number; red2?: number; blue1?: number; blue2?: number }>(
    async (vars) => {
      if (isDemoMode()) return demoUpsertMatches([{ label: null, scheduled_time: null, ...vars } as ParsedMatch]);
      const { error } = await supabase.from('matches').upsert(vars, { onConflict: 'match_number' });
      if (error) throw error;
    }
  );
}

export function useImportMatches() {
  return useMatchMutation<ParsedMatch[]>(async (rows) => {
    if (rows.length === 0) return;
    if (isDemoMode()) return demoUpsertMatches(rows);
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'match_number' });
    if (error) throw error;
  });
}

export function useDeleteMatch() {
  return useMatchMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteMatch(id);
    const { error } = await supabase.from('matches').delete().eq('id', id);
    if (error) throw error;
  });
}

export function useAssignScouter() {
  return useMatchMutation<{ matchId: string; scouterId: string; teamNumber?: number; matchLabel: string }>(
    async ({ matchId, scouterId, teamNumber, matchLabel }) => {
      if (isDemoMode()) return demoAssignScouter({ matchId, scouterId, teamNumber });
      const uid = await currentUserId();
      const { error } = await supabase.from('scouting_assignments').insert({
        match_id: matchId,
        scouter_id: scouterId,
        team_number: teamNumber ?? null,
        assigned_by: uid,
      });
      if (error) throw error;
      await notifyUsers([scouterId], {
        type: 'assignment',
        title: 'New scouting assignment',
        body: teamNumber ? `Scout team ${teamNumber} in ${matchLabel}` : `Scout ${matchLabel}`,
        data: { matchId },
      });
    }
  );
}

export function useRemoveAssignment() {
  return useMatchMutation<string>(async (assignmentId) => {
    if (isDemoMode()) return demoRemoveAssignment(assignmentId);
    const { error } = await supabase.from('scouting_assignments').delete().eq('id', assignmentId);
    if (error) throw error;
  });
}

/** Round-robin assign one scouter to each match that has no assignments yet. */
export function useAutoAssign() {
  return useMatchMutation<void, { assigned: number }>(async () => {
    if (isDemoMode()) return demoAutoAssign();
    const uid = await currentUserId();

    // Prefer members with the 'scouter' role; fall back to all approved members.
    const { data: scouters } = await supabase
      .from('profiles')
      .select('id, full_name, functional_roles')
      .eq('status', 'approved');
    const pool = (scouters ?? []).filter((s: any) => (s.functional_roles ?? []).includes('scouter'));
    const candidates = (pool.length > 0 ? pool : scouters ?? []) as { id: string }[];
    if (candidates.length === 0) return { assigned: 0 };

    const { data: matches } = await supabase
      .from('matches')
      .select('id, label, match_number, assignments:scouting_assignments(id)')
      .order('match_number');
    const unassigned = ((matches ?? []) as any[]).filter((m) => (m.assignments ?? []).length === 0);

    const rows = unassigned.map((m, i) => ({
      match_id: m.id,
      scouter_id: candidates[i % candidates.length].id,
      assigned_by: uid,
    }));
    if (rows.length === 0) return { assigned: 0 };

    const { error } = await supabase.from('scouting_assignments').insert(rows);
    if (error) throw error;

    // Notify each assigned scouter once.
    const byUser = new Map<string, number>();
    rows.forEach((r) => byUser.set(r.scouter_id, (byUser.get(r.scouter_id) ?? 0) + 1));
    await Promise.all(
      Array.from(byUser.entries()).map(([scouterId, count]) =>
        notifyUsers([scouterId], {
          type: 'assignment',
          title: 'New scouting assignments',
          body: `You’ve been assigned ${count} ${count === 1 ? 'match' : 'matches'} to scout.`,
        })
      )
    );
    return { assigned: rows.length };
  });
}

export function useSubmitMatchReport() {
  return useMatchMutation<{
    assignmentId?: string;
    matchId: string;
    matchLabel: string;
    teamNumber: number;
    rating?: number;
    playedDefense: boolean;
    notes?: string;
  }>(async ({ assignmentId, matchId, matchLabel, teamNumber, rating, playedDefense, notes }) => {
    if (isDemoMode()) return demoSubmitMatchReport({ assignmentId, matchId, teamNumber, rating, playedDefense, notes });
    const uid = await currentUserId();
    const { error } = await supabase.from('match_reports').insert({
      assignment_id: assignmentId ?? null,
      match_id: matchId,
      scouter_id: uid,
      team_number: teamNumber,
      rating: rating ?? null,
      played_defense: playedDefense,
      notes: notes ?? null,
    });
    if (error) throw error;

    if (assignmentId) {
      await supabase.from('scouting_assignments').update({ status: 'submitted' }).eq('id', assignmentId);
    }

    await notifyByFunctionalRole(
      'strategist',
      {
        type: 'match_report',
        title: `Match report: team ${teamNumber}`,
        body: `${matchLabel} report submitted.`,
        data: { matchId, teamNumber },
      },
      { excludeUserId: uid }
    );
  });
}
