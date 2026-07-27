import { getEventMatches, getEventTeams, populateTeamNames } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { matchKeys } from './matches';
import { picklistKey } from './picklist';
import { scoutingKeys } from './scouting';
import { ACTIVE_EVENT_KEY, useSetAppSetting } from './settings';
import { MatchInfo, TeamInfo } from '../types';

interface FTCScoutTeamInput {
  teamNumber: number;

  stats: {
    avg: { // modify based on game
      totalPoints: number;
    }
    dqs: number;
    wins: number;
    losses: number;
    ties: number;
    rank: number;
  }
}

interface FTCScoutMatchInput {
  id: number;
  tournamentLevel: string;
  hasBeenPlayed: boolean;

  scheduledStartTime: string;

  scores: {
    blue: {
      autoPoints: number;
      dcPoints: number;
      penaltyPointsByOpp: number;
      totalPoints: number;
    };
    red: {
      autoPoints: number;
      dcPoints: number;
      penaltyPointsByOpp: number;
      totalPoints: number;
    };
  };
  teams: {
    alliance: string;
    dq: boolean;
    teamNumber: number;
  }[];
}

export function useSyncFTCScout() {
  const qc = useQueryClient();
  const setSetting = useSetAppSetting();

  return useMutation({
    mutationFn: async (eventCode: string) => {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 1000));
        return;
      }

      // 1. Fetch from FTC Scout
      const matchesData = (await getEventMatches(eventCode)) as FTCScoutMatchInput[] | null;
      const teamsData = (await getEventTeams(eventCode)) as FTCScoutTeamInput[] | null;
      console.log(matchesData)
      // 2. Parse into clean arrays. The event endpoint only returns numbers, so
      // names come from the GraphQL endpoint.
      const teams: TeamInfo[] = await populateTeamNames(
        (teamsData ?? []).map((t) => ({ team_number: t.teamNumber, team_name: null }))
      );

      const matches: MatchInfo[] = (matchesData ?? []).map((m) => {
        const alliance = (side: string) =>
          (m.teams ?? []).filter((t) => t.alliance.toLowerCase() === side).map((t) => t.teamNumber);
        const [red1 = null, red2 = null] = alliance('red');
        const [blue1 = null, blue2 = null] = alliance('blue');
        return {
          match_number: m.id || 0,
          red1,
          red2,
          blue1,
          blue2,
          has_been_played: m.hasBeenPlayed || false,
          tournament_level: m.tournamentLevel || null,
          scheduled_time: m.scheduledStartTime || null,
          red_score: m.scores?.red?.totalPoints ?? null,
          red_auto: m.scores?.red?.autoPoints ?? null,
          red_dc: m.scores?.red?.dcPoints ?? null,
          red_penalty: m.scores?.red?.penaltyPointsByOpp ?? null,
          blue_score: m.scores?.blue?.totalPoints ?? null,
          blue_auto: m.scores?.blue?.autoPoints ?? null,
          blue_dc: m.scores?.blue?.dcPoints ?? null,
          blue_penalty: m.scores?.red?.penaltyPointsByOpp ?? null,
        };
      });

      // 3. Upsert the roster. Teams whose name lookup failed are written without
      // the column so a bad lookup can't blank a name that's already stored.
      const upsertTeams = async (rows: Record<string, unknown>[]) => {
        if (rows.length === 0) return;
        const { error } = await supabase
          .from('scouted_teams')
          .upsert(rows, { onConflict: 'team_number' });
        if (error) throw error;
      };
      await upsertTeams(
        teams.filter((t) => t.team_name).map((t) => ({ ...t, event_code: eventCode }))
      );
      await upsertTeams(
        teams
          .filter((t) => !t.team_name)
          .map((t) => ({ team_number: t.team_number, event_code: eventCode }))
      );

      // 4. Upsert the schedule.
      if (matches.length > 0) {
        const { error } = await supabase
          .from('matches')
          .upsert(
            matches.map((m) => ({ ...m, event_code: eventCode })),
            { onConflict: 'event_code,match_number' }
          );
        if (error) throw error;
      }

      // 5. Point the app at this event.
      await setSetting.mutateAsync({
        key: ACTIVE_EVENT_KEY,
        value: { eventCode, last_synced: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: matchKeys.all });
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
      qc.invalidateQueries({ queryKey: picklistKey });
    },
  });
}
