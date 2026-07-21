import { getEventMatches, getEventTeams } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateEventData } from './settings';

interface FTCScoutTeamInput {
  teamNumber: number;
  name?: string;
  teamName?: string;
}

interface FTCScoutAlliance {
  teams?: number[];
}

interface FTCScoutMatchInput {
  matchNum?: number;
  matchNumber?: number;
  name?: string;
  description?: string;
  alliances?: {
    red?: FTCScoutAlliance;
    blue?: FTCScoutAlliance;
  };
}

interface ScoutedTeam {
  team_number: number;
  team_name: string | null;
}

interface ScoutedMatch {
  match_number: number;
  label: string;
  red1: number | null;
  red2: number | null;
  blue1: number | null;
  blue2: number | null;
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
      let teamsArray: ScoutedTeam[] = [];
      if (teamsData && Array.isArray(teamsData)) {
        teamsArray = teamsData.map((t: FTCScoutTeamInput): ScoutedTeam => ({
          team_number: t.teamNumber,
          team_name: t.name || t.teamName || null,
        }));
      }

      let matchesArray: ScoutedMatch[] = [];
      if (matchesData && Array.isArray(matchesData)) {
        matchesArray = matchesData.map((m: FTCScoutMatchInput): ScoutedMatch => {
          const redTeams = m.alliances?.red?.teams || [];
          const blueTeams = m.alliances?.blue?.teams || [];
          const matchNum = m.matchNum || m.matchNumber || 0;
          
          return {
            match_number: matchNum,
            label: m.name || m.description || `Match ${matchNum}`,
            red1: redTeams[0] || null,
            red2: redTeams[1] || null,
            blue1: blueTeams[0] || null,
            blue2: blueTeams[1] || null,
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
