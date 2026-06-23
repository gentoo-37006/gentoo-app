import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PitShift } from '@/lib/types';
import type { GeneratedShift } from '@/lib/scheduler';

export const scheduleKey = ['pit_shifts'] as const;
const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';

export type ShiftWithAssignee = PitShift & {
  assignee: { full_name: string | null; avatar_url: string | null } | null;
};

export function usePitShifts() {
  return useQuery({
    queryKey: scheduleKey,
    queryFn: async (): Promise<ShiftWithAssignee[]> => {
      const { data, error } = await supabase
        .from('pit_shifts')
        .select('*, assignee:assignee_id(full_name, avatar_url)')
        .order('start_time', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as ShiftWithAssignee[];
    },
  });
}

function useScheduleMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKey }),
  });
}

/** Replace the whole schedule with a freshly generated rotation. */
export function useReplaceSchedule() {
  return useScheduleMutation<GeneratedShift[]>(async (shifts) => {
    const { error: delErr } = await supabase.from('pit_shifts').delete().neq('id', IMPOSSIBLE_ID);
    if (delErr) throw delErr;
    if (shifts.length === 0) return;
    const rows = shifts.map((s) => ({
      start_time: s.start.toISOString(),
      end_time: s.end.toISOString(),
      assignee_id: s.assigneeId,
      generated: true,
    }));
    const { error } = await supabase.from('pit_shifts').insert(rows);
    if (error) throw error;
  });
}

export function useClearSchedule() {
  return useScheduleMutation<void>(async () => {
    const { error } = await supabase.from('pit_shifts').delete().neq('id', IMPOSSIBLE_ID);
    if (error) throw error;
  });
}

export function useReassignShift() {
  return useScheduleMutation<{ id: string; assigneeId: string | null }>(async ({ id, assigneeId }) => {
    const { error } = await supabase.from('pit_shifts').update({ assignee_id: assigneeId }).eq('id', id);
    if (error) throw error;
  });
}

export function useDeleteShift() {
  return useScheduleMutation<string>(async (id) => {
    const { error } = await supabase.from('pit_shifts').delete().eq('id', id);
    if (error) throw error;
  });
}
