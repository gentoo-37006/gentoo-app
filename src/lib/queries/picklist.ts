import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { demoPicklist, demoSetPicklist, isDemoMode } from '@/lib/demo';
import type { PicklistTier, TeamScore } from '@/lib/types';
import { scoutingKeys } from '@/lib/queries/scouting';

export const picklistKey = ['picklist'] as const;

export type PicklistTeam = {
  id: string;
  team_number: number;
  team_name: string | null;
  entry_count: number;
  tier: PicklistTier | null;
  /** Manual position within the tier (lower = higher pick). */
  rank: number | null;
  notes: string | null;
  /** question_id -> yes-percent */
  capabilities: Record<string, number>;
};

/** Within a tier: manual rank first (nulls last), then team number. */
export function tierSort(a: PicklistTeam, b: PicklistTeam): number {
  if (a.rank !== null && b.rank !== null && a.rank !== b.rank) return a.rank - b.rank;
  if (a.rank !== null && b.rank === null) return -1;
  if (a.rank === null && b.rank !== null) return 1;
  return a.team_number - b.team_number;
}

export function usePicklist() {
  return useQuery({
    queryKey: picklistKey,
    queryFn: async (): Promise<PicklistTeam[]> => {
      if (isDemoMode()) return demoPicklist();
      const [scores, teams, caps, activeEventPointer] = await Promise.all([
        supabase.from('team_scores').select('*'),
        supabase.from('scouted_teams').select('id, picklist_tier, picklist_rank, picklist_notes, team_number'),
        supabase.from('team_capability_scores').select('team_id, question_id, percent'),
        supabase.from('event_data').select('data').eq('event_code', 'active_event').maybeSingle(),
      ]);
      if (scores.error) throw scores.error;
      if (teams.error) throw teams.error;
      if (caps.error) throw caps.error;

      const metaById = new Map<
        string,
        { tier: PicklistTier | null; rank: number | null; notes: string | null }
      >();
      for (const t of teams.data ?? []) {
        metaById.set(t.id as string, {
          tier: (t.picklist_tier as PicklistTier | null) ?? null,
          rank: (t.picklist_rank as number | null) ?? null,
          notes: (t.picklist_notes as string | null) ?? null,
        });
      }

      const capsByTeam = new Map<string, Record<string, number>>();
      for (const c of caps.data ?? []) {
        const map = capsByTeam.get(c.team_id as string) ?? {};
        map[c.question_id as string] = Number(c.percent);
        capsByTeam.set(c.team_id as string, map);
      }

      let activeTeamNumbers = new Set<number>();
      if (activeEventPointer.data?.data?.eventCode) {
        const { data: eventData } = await supabase
          .from('event_data')
          .select('data')
          .eq('event_code', activeEventPointer.data.data.eventCode)
          .maybeSingle();
        const eventTeams = eventData?.data?.teams || [];
        activeTeamNumbers = new Set(eventTeams.map((t: any) => t.team_number));
      }

      return (scores.data as TeamScore[])
        .filter((s) => activeTeamNumbers.size === 0 || activeTeamNumbers.has(s.team_number))
        .map((s) => ({
          id: s.team_id,
          team_number: s.team_number,
          team_name: s.team_name,
          entry_count: s.entry_count,
          tier: metaById.get(s.team_id)?.tier ?? null,
          rank: metaById.get(s.team_id)?.rank ?? null,
          notes: metaById.get(s.team_id)?.notes ?? null,
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

/**
 * Drop a team into a tier at a position: sets the team's tier, then renumbers
 * the whole target tier (orderedIds includes the moved team at its new index).
 */
export function useMoveTeam() {
  return usePicklistMutation<{ teamId: string; tier: PicklistTier | null; orderedIds: string[] }>(
    async ({ teamId, tier, orderedIds }) => {
      if (isDemoMode()) {
        await demoSetPicklist(teamId, { picklist_tier: tier });
        for (let i = 0; i < orderedIds.length; i++) {
          await demoSetPicklist(orderedIds[i], { picklist_rank: i + 1 });
        }
        return;
      }
      const { error } = await supabase
        .from('scouted_teams')
        .update({ picklist_tier: tier })
        .eq('id', teamId);
      if (error) throw error;
      const results = await Promise.all(
        orderedIds.map((id, i) =>
          supabase.from('scouted_teams').update({ picklist_rank: i + 1 }).eq('id', id)
        )
      );
      for (const r of results) if (r.error) throw r.error;
    }
  );
}

export function useSetPicklistNotes() {
  return usePicklistMutation<{ teamId: string; notes: string }>(async ({ teamId, notes }) => {
    if (isDemoMode()) return demoSetPicklist(teamId, { picklist_notes: notes || null });
    const { error } = await supabase
      .from('scouted_teams')
      .update({ picklist_notes: notes || null })
      .eq('id', teamId);
    if (error) throw error;
  });
}
