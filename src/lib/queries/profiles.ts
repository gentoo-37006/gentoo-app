import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { demoProfiles, demoSetProfile, isDemoMode } from '@/lib/demo';
import type { FunctionalRole, Profile, UserRole, UserStatus } from '@/lib/types';

export const profilesKey = ['profiles'] as const;

/** All profiles, oldest first. Readable by approved members (admins act on it). */
export function useProfiles() {
  return useQuery({
    queryKey: profilesKey,
    queryFn: async (): Promise<Profile[]> => {
      if (isDemoMode()) return demoProfiles();
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data ?? []) as Profile[];
    },
  });
}

function useProfileMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: profilesKey }),
  });
}

export function useSetUserStatus() {
  return useProfileMutation<{ id: string; status: UserStatus }>(async ({ id, status }) => {
    if (isDemoMode()) return demoSetProfile(id, { status });
    const { error } = await supabase.from('profiles').update({ status }).eq('id', id);
    if (error) throw error;
  });
}

export function useSetUserRole() {
  return useProfileMutation<{ id: string; role: UserRole }>(async ({ id, role }) => {
    if (isDemoMode()) return demoSetProfile(id, { role });
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id);
    if (error) throw error;
  });
}

export function useSetFunctionalRoles() {
  return useProfileMutation<{ id: string; functional_roles: FunctionalRole[] }>(
    async ({ id, functional_roles }) => {
      if (isDemoMode()) return demoSetProfile(id, { functional_roles });
      const { error } = await supabase
        .from('profiles')
        .update({ functional_roles })
        .eq('id', id);
      if (error) throw error;
    }
  );
}
