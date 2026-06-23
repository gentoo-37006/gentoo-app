import * as React from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { isSupabaseConfigured } from '@/lib/env';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  /** True until the initial session + profile have been resolved. */
  initializing: boolean;
  isConfigured: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isApproved: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[auth] failed to load profile:', error.message);
    return null;
  }
  return (data as Profile) ?? null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [authResolved, setAuthResolved] = React.useState(false);
  const [profileResolved, setProfileResolved] = React.useState(false);

  // Subscribe to auth state. Profile loading is handled separately (below) to
  // avoid running queries inside the auth callback.
  React.useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthResolved(true);
      setProfileResolved(true);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthResolved(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setAuthResolved(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load the profile whenever the signed-in user changes.
  const userId = session?.user?.id;
  React.useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    if (!userId) {
      setProfile(null);
      setProfileResolved(true);
      return;
    }
    setProfileResolved(false);
    fetchProfile(userId).then((p) => {
      if (!active) return;
      setProfile(p);
      setProfileResolved(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = React.useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setProfile(await fetchProfile(userId));
  }, [userId]);

  const signOut = React.useCallback(async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      initializing: !authResolved || !profileResolved,
      isConfigured: isSupabaseConfigured,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      isApproved: profile?.status === 'approved',
      refreshProfile,
      signOut,
    }),
    [authResolved, profileResolved, session, profile, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
