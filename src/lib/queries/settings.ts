import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo';
import type { AppSetting } from '@/lib/types';

export const ACTIVE_EVENT_KEY = 'active_event';

export function appSettingKey(key: string) {
  return ['app_settings', key] as const;
}

/** Event the app is scoped to; '' until an event has been synced. */
export async function activeEventCode(): Promise<string> {
  if (isDemoMode()) return '';
  const { data } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', ACTIVE_EVENT_KEY)
    .maybeSingle();
  return (data?.value?.eventCode as string) ?? '';
}

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: appSettingKey(key),
    queryFn: async (): Promise<AppSetting | null> => {
      if (isDemoMode()) return null;
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data as AppSetting | null;
    },
  });
}

export function useSetAppSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: Record<string, unknown> }) => {
      if (isDemoMode()) return;
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, { key }) => {
      qc.invalidateQueries({ queryKey: appSettingKey(key) });
    },
  });
}
