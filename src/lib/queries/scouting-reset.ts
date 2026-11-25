import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { demoResetScouting, isDemoMode } from '@/lib/demo';
import { matchKeys } from '@/lib/queries/matches';
import { picklistKey } from '@/lib/queries/picklist';
import { scoutingKeys } from '@/lib/queries/scouting';
import {
  scoutingResetSteps,
  type ScoutingResetOptions,
  type ScoutingResetResult,
} from '@/lib/scouting-reset';

/**
 * Admin-only: wipe scouting data before a new event. The database enforces
 * the admin part — row-level security only lets admins delete reports, pit
 * entries and assignments (0003/0004) — so a member's attempt removes nothing.
 * Each step reports how many rows it touched, which is how that shows up.
 */
export function useResetScouting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (options: ScoutingResetOptions): Promise<ScoutingResetResult> => {
      if (isDemoMode()) return demoResetScouting(options);
      const result: ScoutingResetResult = {};
      for (const step of scoutingResetSteps(options)) {
        if (step.action === 'delete') {
          // PostgREST refuses a DELETE without a filter; every row has an id.
          const { error, count } = await supabase
            .from(step.table)
            .delete({ count: 'exact' })
            .not('id', 'is', null);
          if (error) throw error;
          result[step.table] = count ?? 0;
        } else {
          const patch = Object.fromEntries(step.columns.map((column) => [column, null]));
          const { error, count } = await supabase
            .from(step.table)
            .update({ ...patch, updated_at: new Date().toISOString() }, { count: 'exact' })
            .not('id', 'is', null);
          if (error) throw error;
          result[step.table] = count ?? 0;
        }
      }
      return result;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: scoutingKeys.teamScores });
      qc.invalidateQueries({ queryKey: ['scouted_team'] });
      qc.invalidateQueries({ queryKey: ['team_entries'] });
      qc.invalidateQueries({ queryKey: matchKeys.all });
      qc.invalidateQueries({ queryKey: ['my_assignments'] });
      qc.invalidateQueries({ queryKey: ['match'] });
      qc.invalidateQueries({ queryKey: picklistKey });
    },
  });
}
