import { useQuery } from '@tanstack/react-query';
import { getEventTeams } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import type { MatchReport } from '@/lib/types';

/** Subset of the FTC Scout event-participation stats used for head-to-head. */
export type EventTeamStats = {
  rank: number | null;
  rp: number | null;
  wins: number;
  losses: number;
  ties: number;
  avg?: { totalPoints: number; autoPoints: number; dcPoints: number };
  opr?: { totalPoints: number; autoPoints: number; dcPoints: number };
  max?: { totalPoints: number };
};

/**
 * Live per-team stats for the active event. The sync only persists team numbers
 * into event_data, so the numbers are pulled straight from FTC Scout here.
 */
export function useEventTeamStats(enabled = true) {
  return useQuery({
    queryKey: ['ftcscout_team_stats'],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<number, EventTeamStats>> => {
      if (isDemoMode()) return {};
      const { data: pointer } = await supabase
        .from('event_data')
        .select('data')
        .eq('event_code', 'active_event')
        .maybeSingle();
      const eventCode = pointer?.data?.eventCode;
      if (!eventCode) return {};

      const participations = (await getEventTeams(eventCode)) as
        | { teamNumber: number; stats: EventTeamStats | null }[]
        | null;
      const byTeam: Record<number, EventTeamStats> = {};
      for (const p of participations ?? []) if (p.stats) byTeam[p.teamNumber] = p.stats;
      return byTeam;
    },
  });
}

export function useTeamMatchReports(teamNumber?: number) {
  return useQuery({
    queryKey: ['team_match_reports', teamNumber],
    enabled: !!teamNumber,
    queryFn: async (): Promise<MatchReport[]> => {
      if (isDemoMode()) return [];
      const { data, error } = await supabase
        .from('match_reports')
        .select('*')
        .eq('team_number', teamNumber!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as MatchReport[];
    },
  });
}
