import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { APP_VERSION } from '@/lib/app-version';
import {
  RELEASE_CHANNEL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
} from '@/lib/env';
import { functionUrl } from '@/lib/function-url';

/**
 * Release notes for the running version, served from GitHub Releases via the
 * downloads Edge Function (the repo is private, so clients can't read GitHub
 * directly). Exact tag v<APP_VERSION> first; the function falls back to the
 * channel's latest release when that tag doesn't exist.
 */

export type ReleaseNotes = {
  tag: string | null;
  title: string | null;
  notes: string | null;
  publishedAt: string | null;
};

/** Empty when unconfigured — see lib/function-url.ts. */
const ENDPOINT = functionUrl(SUPABASE_URL, 'downloads');
const LAST_SEEN_KEY = 'gentoo.whats-new.last-seen-version';

export function useReleaseNotes(enabled = true) {
  return useQuery({
    queryKey: ['release-notes', APP_VERSION, RELEASE_CHANNEL],
    enabled: enabled && isSupabaseConfigured,
    staleTime: 60 * 60_000,
    queryFn: async (): Promise<ReleaseNotes> => {
      const res = await fetch(
        `${ENDPOINT}?notes=${encodeURIComponent(APP_VERSION)}&channel=${RELEASE_CHANNEL}`,
        { headers: { Accept: 'application/json', apikey: SUPABASE_ANON_KEY } }
      );
      if (!res.ok) throw new Error('Failed to load release notes');
      return res.json();
    },
  });
}

/**
 * True when this launch is the first on this version — right after an update,
 * or the first-ever run (so the first build shipping this feature pops too).
 * The version is recorded as seen only when the popup is dismissed.
 */
export async function shouldShowWhatsNew(): Promise<boolean> {
  try {
    const seen = await AsyncStorage.getItem(LAST_SEEN_KEY);
    return seen !== APP_VERSION;
  } catch {
    return false;
  }
}

export async function markWhatsNewSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_SEEN_KEY, APP_VERSION);
  } catch {
    // Best effort — worst case the popup shows again next launch.
  }
}
