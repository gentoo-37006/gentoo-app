import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo';
import type { EventData } from '@/lib/types';

export function eventDataKey(eventCode: string) {
  return ['event_data', eventCode] as const;
}

export function useEventData(eventCode: string) {
  return useQuery({
    queryKey: eventDataKey(eventCode),
    queryFn: async (): Promise<EventData | null> => {
      if (isDemoMode()) return null; // Mock if necessary
      const { data, error } = await supabase
        .from('event_data')
        .select('*')
        .eq('event_code', eventCode)
        .maybeSingle();
      if (error) throw error;
      return data as EventData | null;
    },
  });
}

export function useUpdateEventData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ event_code, data }: { event_code: string; data: Record<string, unknown> }) => {
      if (isDemoMode()) return;
      const { error } = await supabase
        .from('event_data')
        .upsert({ event_code, data, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, { event_code }) => {
      qc.invalidateQueries({ queryKey: eventDataKey(event_code) });
    },
  });
}
