import { getEventMatches, getEventTeams } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateEventData } from './settings';

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

interface ScoutedTeam {
  team_number: number;
  team_name: string | null;
}

interface ScoutedMatch {
  match_number: number;
  red1: number | null;
  red2: number | null;
  blue1: number | null;
  blue2: number | null;
  red_score?: number | null;
  red_auto?: number | null;
  red_dc?: number | null;
  blue_score?: number | null;
  blue_auto?: number | null;
  blue_dc?: number | null;
  has_been_played?: boolean;
  tournament_level?: string | null;
  scheduled_time?: string | null;
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
      console.log(teamsData);
      // 2. Parse into clean array
      let teamsArray: ScoutedTeam[] = [];
      if (teamsData && Array.isArray(teamsData)) {
        teamsArray = teamsData.map((t: FTCScoutTeamInput): ScoutedTeam => ({
          team_number: t.teamNumber,
          team_name: null,
        }));
      }

      let matchesArray: ScoutedMatch[] = [];
      if (matchesData && Array.isArray(matchesData)) {
        matchesArray = matchesData.map((m: FTCScoutMatchInput): ScoutedMatch => {
          
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

      // 6. Push the array data into the relational tables for relations
      if (teamsArray.length > 0) {
        await supabase.from('scouted_teams').upsert(teamsArray, { onConflict: 'team_number' });
      }
      if (matchesArray.length > 0) {
        await supabase.from('matches').upsert(matchesArray, { onConflict: 'match_number' });
      }
    },
    onSuccess: () => {
      // Invalidate your queries so the UI pulls the fresh nested data
      qc.invalidateQueries({ queryKey: ['event_syncs'] });
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
