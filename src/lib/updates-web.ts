import * as React from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { COMMIT_SHA } from '@/lib/env';

/**
 * Web-only "a newer build is deployed" detector.
 *
 * Each deploy publishes /version.json (see scripts/write-version.js). The running
 * tab knows its own build id from what was baked into the bundle at build time —
 * the commit SHA on nightly, or the app version on release — and polls the manifest
 * to see if a newer build is live. Native uses expo-updates instead (see _layout).
 */

const POLL_MS = 60_000;

type Manifest = { id?: string; commit?: string; version?: string };

export type UpdateChannel = 'nightly' | 'release';

export function useWebUpdateAvailable() {
  const version = Constants.expoConfig?.version ?? '';
  const channel: UpdateChannel = COMMIT_SHA ? 'nightly' : 'release';
  const currentId = COMMIT_SHA || version;

  const [available, setAvailable] = React.useState(false);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !currentId) return;

    let cancelled = false;

    async function check() {
      try {
        const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const manifest: Manifest = await res.json();
        const latestId = manifest.id ?? manifest.commit ?? manifest.version ?? '';
        if (!cancelled && latestId && latestId !== currentId) setAvailable(true);
      } catch {
        // Offline, or this build predates version.json — nothing to do.
      }
    }

    check();
    const interval = setInterval(check, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [currentId]);

  const reload = React.useCallback(() => {
    if (Platform.OS === 'web') window.location.reload();
  }, []);

  const dismiss = React.useCallback(() => setAvailable(false), []);

  return { available, channel, reload, dismiss };
}
