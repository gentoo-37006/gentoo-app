import { getEventMatches, getEventTeams } from '@/lib/api/ftcscout';
import { isDemoMode } from '@/lib/demo';
import { supabase } from '@/lib/supabase';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useUpdateAppSetting } from './settings';

export function useSyncFTCScout() {
  const qc = useQueryClient();
  const updateSetting = useUpdateAppSetting();

  return useMutation({
    mutationFn: async (eventCode: string) => {
      if (isDemoMode()) {
        // Just mock success
        await new Promise((r) => setTimeout(r, 1000));
        return;
      }

      // 1. Fetch from FTC Scout
      const matchesData = await getEventMatches(eventCode);
      const teamsData = await getEventTeams(eventCode);
      
      // 2. Wipe existing data
      const { error: clearMatchesError } = await supabase
        .from('matches')
        .delete()
        .neq('match_number', 1);
      if (clearMatchesError) throw clearMatchesError;

      const { error: clearTeamsError } = await supabase
        .from('scouted_teams')
        .delete()
        .neq('team_number', 16488);
      if (clearTeamsError) {
         console.log("bum")
 throw clearTeamsError;
      }

      // 3. Parse and bulk upsert Teams
      if (teamsData && Array.isArray(teamsData)) {
        const teamsToInsert = teamsData.map((t: any) => ({
          team_number: t.teamNumber,
          team_name: t.name || t.teamName || null,
        }));
        
        if (teamsToInsert.length > 0) {
          const { error: teamsError } = await supabase
            .from('scouted_teams')
            .upsert(teamsToInsert, { onConflict: 'team_number' });
          if (teamsError) throw teamsError;
        }
      }

      // 3. Parse and bulk upsert Matches
      if (matchesData && Array.isArray(matchesData)) {
        const matchesToInsert = matchesData.map((m: any) => {
          // Assume standard format: m.matchNum, m.alliances etc.
          // Adjust based on actual FTC Scout payload once known
          const redTeams = m.alliances?.red?.teams || [];
          const blueTeams = m.alliances?.blue?.teams || [];
          return {
            match_number: m.matchNum || m.matchNumber,
            label: m.name || m.description || `Match ${m.matchNum}`,
            red1: redTeams[0] || null,
            red2: redTeams[1] || null,
            blue1: blueTeams[0] || null,
            blue2: blueTeams[1] || null,
          };
        });

        if (matchesToInsert.length > 0) {
          const { error: matchesError } = await supabase
            .from('matches')
            .upsert(matchesToInsert, { onConflict: 'match_number' });
          if (matchesError) throw matchesError;
        }
      }

      // 4. Update the last synced timestamp in settings
      await updateSetting.mutateAsync({
        key: 'ftcscout_sync',
        value: { eventCode, last_synced: new Date().toISOString() },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
}
