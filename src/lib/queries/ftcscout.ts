import { getEventMatches, getEventTeams, populateTeamNames } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { matchKeys } from './matches';
import { picklistKey } from './picklist';
import { scoutingKeys } from './scouting';
import { useUpdateEventData } from './settings';
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
      totalPoints: number;
    };
    red: {
      autoPoints: number;
      dcPoints: number;
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
  const updateEventData = useUpdateEventData();

  return useMutation({
    mutationFn: async (eventCode: string) => {
      if (isDemoMode()) {
        await new Promise((r) => setTimeout(r, 1000));
        return;
      }

      // 1. Fetch from FTC Scout
      const matchesData = (await getEventMatches(eventCode)) as FTCScoutMatchInput[] | null;
      const teamsData = (await getEventTeams(eventCode)) as FTCScoutTeamInput[] | null;

      // 2. Parse into clean array
      let teamsArray: TeamInfo[] = [];
      if (teamsData && Array.isArray(teamsData)) {
        teamsArray = teamsData.map((t: FTCScoutTeamInput): TeamInfo => ({
          team_number: t.teamNumber,
          team_name: null,
        }));
        if (teamsArray.length > 0) {
          teamsArray = await populateTeamNames(teamsArray);
        }
      }

      let matchesArray: MatchInfo[] = [];
      if (matchesData && Array.isArray(matchesData)) {
        matchesArray = matchesData.map((m: FTCScoutMatchInput): MatchInfo => {
          
          const matchNum = m.id || 0;
          const redTeams: number[] = [];
          const blueTeams: number[] = [];
          for(const team of m.teams || []) {
            if(team.alliance.toLowerCase() === "red") {
              redTeams.push(team.teamNumber);
            } else {
              blueTeams.push(team.teamNumber);
            }
          }
          
          return {
            match_number: matchNum,
            red1: redTeams[0] || null,
            red2: redTeams[1] || null,
            blue1: blueTeams[0] || null,
            blue2: blueTeams[1] || null,
            has_been_played: m.hasBeenPlayed || false,
            tournament_level: m.tournamentLevel || null,
            scheduled_time: m.scheduledStartTime || null,
            red_score: m.scores?.red?.totalPoints ?? null,
            red_auto: m.scores?.red?.autoPoints ?? null,
            red_dc: m.scores?.red?.dcPoints ?? null,
            blue_score: m.scores?.blue?.totalPoints ?? null,
            blue_auto: m.scores?.blue?.autoPoints ?? null,
            blue_dc: m.scores?.blue?.dcPoints ?? null,
          };
        });
      }
      
      // 4. Upsert entire event payload into event_data
      const { error: syncError } = await supabase
        .from('event_data') 
        .upsert({
          event_code: eventCode,
          data: {
            teams: teamsArray,
            matches: matchesArray,
          },
          updated_at: new Date().toISOString()
        }, { onConflict: 'event_code' });

      if (syncError) {
        console.warn("Failed to sync event payload (maybe the event_data table doesn't exist yet?):", syncError.message);
        // We do NOT throw here! We want to gracefully continue so that the relational
        // tables still get populated even if the user doesn't have privileges to 
        // create the event_data table yet.
      }

      // 5. Update the 'active_event' pointer in event_data (gracefully handle failure)
      try {
        await updateEventData.mutateAsync({
          event_code: 'active_event',
          data: { eventCode, last_synced: new Date().toISOString() },
        });
      } catch (err: any) {
        console.warn("Failed to update active_event pointer (table likely missing):", err.message);
      }

      // 6. Push the array data into the relational tables for relations.
      // team_name is omitted — the FTC Scout event endpoint doesn't return names,
      // so writing it would blank out any name already stored.
      if (teamsArray.length > 0) {
        const { error: teamError } = await supabase
          .from('scouted_teams')
          .upsert(teamsArray.map(({ team_number }) => ({ team_number })), { onConflict: 'team_number' });
        if (teamError) throw teamError;
      }
      // Only the columns `matches` actually has — scores live in event_data. Sending the
      // score fields makes PostgREST reject the whole batch, which leaves every match
      // without a row (and therefore unassignable).
      if (matchesArray.length > 0) {
        const { error: matchError } = await supabase.from('matches').upsert(
          matchesArray.map((m) => ({
            match_number: m.match_number,
            scheduled_time: m.scheduled_time,
            red1: m.red1,
            red2: m.red2,
            blue1: m.blue1,
            blue2: m.blue2,
          })),
          { onConflict: 'match_number' }
        );
        if (matchError) throw matchError;
      }
    },
    onSuccess: () => {
      // Invalidate your queries so the UI pulls the fresh nested data
      qc.invalidateQueries({ queryKey: matchKeys.all });
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
      qc.invalidateQueries({ queryKey: picklistKey });
    },
  });
}
