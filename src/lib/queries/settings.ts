import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { isDemoMode } from '@/lib/demo';
import type { AppSettings } from '@/lib/types';

export function settingsKey(key: string) {
  return ['app_settings', key] as const;
}

export function useAppSetting(key: string) {
  return useQuery({
    queryKey: settingsKey(key),
    queryFn: async (): Promise<AppSettings | null> => {
      if (isDemoMode()) return null; // Mock if necessary
      const { data, error } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      if (error) throw error;
      return data as AppSettings | null;
    },
  });
}

export function useUpdateAppSetting() {
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
      qc.invalidateQueries({ queryKey: settingsKey(key) });
    },
  });
}
