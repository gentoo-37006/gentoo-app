import * as React from 'react';
import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { authStorageKey, supabase } from '@/lib/supabase';
import { parseStoredSession } from '@/lib/auth-startup';
import { isSupabaseConfigured } from '@/lib/env';
import {
  readCachedProfile,
  removeCachedProfile,
  writeCachedProfile,
} from '@/lib/auth-profile-cache';
import {
  DEMO_USER_ID,
  demoProfile,
  demoSession,
  initDemoAuth,
  isDemoMode,
  startDemoAuth,
  stopDemoAuth,
} from '@/lib/demo';
import type { Profile } from '@/lib/types';

type AuthContextValue = {
  /** True until the initial session + profile have been resolved. */
  initializing: boolean;
  isConfigured: boolean;
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  isApproved: boolean;
  isDemo: boolean;
  signInDemo: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

/** Attempts before giving up, so one flaky request doesn't decide the session. */
const PROFILE_FETCH_ATTEMPTS = 3;
const PROFILE_RETRY_BASE_MS = 400;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ProfileFetchResult =
  | { available: true; profile: Profile | null }
  | { available: false };

/** A failed request is different from a successful response with no profile. */
async function fetchProfile(userId: string): Promise<ProfileFetchResult> {
  for (let attempt = 1; attempt <= PROFILE_FETCH_ATTEMPTS; attempt++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (!error) return { available: true, profile: (data as Profile) ?? null };

    console.warn(
      `[auth] failed to load profile (attempt ${attempt}/${PROFILE_FETCH_ATTEMPTS}):`,
      error.message
    );
    if (attempt < PROFILE_FETCH_ATTEMPTS) await delay(PROFILE_RETRY_BASE_MS * attempt);
  }
  return { available: false };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = React.useState<Session | null>(null);
  const [profile, setProfile] = React.useState<Profile | null>(null);
  const [authResolved, setAuthResolved] = React.useState(false);
  const [profileResolved, setProfileResolved] = React.useState(false);
  // Demo mode as React state: render logic must NOT call isDemoMode() (a
  // mutable module-global read) — the React Compiler memoizes renders
  // assuming purity, and a cached stale `false` wedges the sign-in flow.
  // Effects and callbacks may still read isDemoMode() directly.
  const [demoActive, setDemoActive] = React.useState(false);

  // Subscribe to auth state. Profile loading is handled separately (below) to
  // avoid running queries inside the auth callback.
  React.useEffect(() => {
    let sub: { subscription: { unsubscribe: () => void } } | null = null;
    let cancelled = false;
    let startupFinished = false;
    let startupTimer: ReturnType<typeof setTimeout> | undefined;
    const applySession = (next: Session | null) => {
      if (cancelled) return;
      setSession(next);
      setAuthResolved(true);
      if (!next?.user?.id) setProfileResolved(true);
    };
    const restoreOfflineSession = async () => {
      try {
        const next = Platform.OS === 'web' ? null : parseStoredSession(await AsyncStorage.getItem(authStorageKey));
        if (!cancelled && !startupFinished) applySession(next);
      } catch {
        if (!cancelled && !startupFinished) applySession(null);
      }
    };

    initDemoAuth().then(async (active) => {
      if (cancelled) return;
      if (active) {
        setDemoActive(true);
        setSession(demoSession());
        setProfile(await demoProfile());
        setAuthResolved(true);
        setProfileResolved(true);
        // Screens mounted before this resolved already fired their queries
        // with isDemoMode() still false (against Supabase) and cached empty
        // results. resetQueries (not clear) — it also refetches the active
        // observers, which clear() leaves stranded on the removed cache.
        queryClient.resetQueries();
        return;
      }

      if (!isSupabaseConfigured) {
        setAuthResolved(true);
        setProfileResolved(true);
        return;
      }
      // Refreshing an expired token requires internet. Allow the existing local
      // session/profile gate to settle on robot Wi-Fi, then reconcile online.
      startupTimer = setTimeout(() => void restoreOfflineSession(), 5_000);
      void supabase.auth.getSession().then(async ({ data, error }) => {
        if (cancelled || startupFinished) return;
        clearTimeout(startupTimer);
        if (error && isAuthRetryableFetchError(error)) await restoreOfflineSession();
        else applySession(data.session);
        startupFinished = true;
      }).catch(async (error) => {
        console.warn('[auth] session startup failed', error);
        if (cancelled || startupFinished) return;
        clearTimeout(startupTimer);
        applySession(null);
        startupFinished = true;
      });
      const { data } = supabase.auth.onAuthStateChange((event, next) => {
        if (cancelled) return;
        // INITIAL_SESSION can be null after an offline token refresh. The
        // getSession result above distinguishes this from a genuine sign-out.
        if (event === 'INITIAL_SESSION') return;
        startupFinished = true;
        clearTimeout(startupTimer);
        applySession(next);
      });
      sub = data;
    }).catch((error) => {
      console.warn('[auth] initialization failed', error);
      applySession(null);
    });

    return () => {
      cancelled = true;
      clearTimeout(startupTimer);
      sub?.subscription.unsubscribe();
    };
  }, [queryClient]);

  // Reset profile state the moment the signed-in user changes. Render-time
  // adjustment (react.dev "adjusting state when props change") instead of a
  // sync setState inside the effect; the demo path manages profile itself.
  const userId = session?.user?.id;
  const [prevUserId, setPrevUserId] = React.useState(userId);
  if (prevUserId !== userId) {
    setPrevUserId(userId);
    if (isSupabaseConfigured && !demoActive && userId !== DEMO_USER_ID) {
      setProfile(null);
      setProfileResolved(!userId);
    }
  }

  // Restore the last verified profile before asking the server. This lets an
  // approved user stay signed in while connected to a Control Hub network,
  // which intentionally has no internet access.
  React.useEffect(() => {
    let active = true;
    if (!isSupabaseConfigured) return;
    if (isDemoMode() || userId === DEMO_USER_ID) return;
    if (!userId) return;
    void (async () => {
      const cached = await readCachedProfile(userId);
      if (!active) return;
      if (cached) {
        setProfile(cached);
        setProfileResolved(true);
      }

      const result = await fetchProfile(userId);
      if (!active) return;

      if (result.available) {
        setProfile(result.profile);
        setProfileResolved(true);
        if (result.profile) await writeCachedProfile(result.profile);
        else await removeCachedProfile(userId);
      } else if (!cached) {
        // With no previously verified account data, /pending explains that the
        // server is unavailable and offers a retry.
        setProfileResolved(true);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = React.useCallback(async () => {
    if (isDemoMode()) {
      setProfile(await demoProfile());
      return;
    }
    if (!userId) {
      setProfile(null);
      return;
    }
    const result = await fetchProfile(userId);
    if (!result.available) return;
    setProfile(result.profile);
    if (result.profile) await writeCachedProfile(result.profile);
    else await removeCachedProfile(userId);
  }, [userId]);

  const signOut = React.useCallback(async () => {
    if (userId) await removeCachedProfile(userId);
    if (isDemoMode()) await stopDemoAuth();
    else await supabase.auth.signOut({ scope: 'local' });
    setDemoActive(false);
    queryClient.clear();
    setSession(null);
    setProfile(null);
    setAuthResolved(true);
    setProfileResolved(true);
  }, [queryClient, userId]);

  const signInDemo = React.useCallback(async () => {
    queryClient.clear();
    await startDemoAuth();
    setDemoActive(true);
    setSession(demoSession());
    setProfile(await demoProfile());
    setAuthResolved(true);
    setProfileResolved(true);
  }, [queryClient]);

  const value = React.useMemo<AuthContextValue>(
    () => ({
      initializing: !authResolved || !profileResolved,
      // Demo mode counts as configured: it runs entirely on local seed data,
      // and the navigator must route demo sessions into the app.
      isConfigured: isSupabaseConfigured || demoActive,
      session,
      profile,
      isAdmin: profile?.role === 'admin',
      isApproved: profile?.status === 'approved',
      isDemo: demoActive,
      signInDemo,
      refreshProfile,
      signOut,
    }),
    [authResolved, profileResolved, demoActive, session, profile, signInDemo, refreshProfile, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
