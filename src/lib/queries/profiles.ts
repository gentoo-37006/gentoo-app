import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { demoProfiles, demoSetProfile, isDemoMode, stopDemoAuth } from '@/lib/demo';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { functionUrl } from '@/lib/function-url';
import type { FunctionalRole, Profile, UserRole, UserStatus } from '@/lib/types';

export const profilesKey = ['profiles'] as const;

/**
 * Permanently delete the signed-in user's own account.
 *
 * Required by App Store Review Guideline 5.1.1(v). The actual deletion needs
 * the service role, so it runs in the `delete-account` Edge Function — this
 * only hands over the caller's access token, and the function derives the
 * account to delete from that token rather than from anything sent here.
 *
 * In demo mode there is no account to delete: the workspace lives entirely in
 * AsyncStorage, so tearing it down locally is the honest equivalent.
 */
export async function deleteOwnAccount(): Promise<void> {
  if (isDemoMode()) {
    await stopDemoAuth();
    return;
  }

  const endpoint = functionUrl(SUPABASE_URL, 'delete-account');
  if (!endpoint) throw new Error('Backend not configured');

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  if (!res.ok) throw new Error('Could not delete the account');

  // The user row is gone; clear the local session so the app cannot keep
  // making requests with a token that no longer resolves to anyone.
  await supabase.auth.signOut();
}

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

/** Count-only query for the global admin navigation badge. */
export function usePendingApprovalCount(enabled: boolean) {
  return useQuery({
    queryKey: [...profilesKey, 'pending-count'],
    enabled,
    queryFn: async (): Promise<number> => {
      if (isDemoMode()) {
        const profiles = await demoProfiles();
        return profiles.filter((profile) => profile.status === 'pending').length;
      }
      const { count, error } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending');
      if (error) throw error;
      return count ?? 0;
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
