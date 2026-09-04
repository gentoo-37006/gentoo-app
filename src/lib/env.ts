/**
 * Public runtime config. All values come from `EXPO_PUBLIC_*` env vars (safe to
 * ship in the client bundle) and are read from a local `.env` — see `.env.example`.
 */
import { PRODUCTION_WEB_URL } from '@/lib/label-origin';
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Git commit SHA baked in at build time (set on the beta deploy). Empty on
 *  builds that don't provide it — callers fall back to the app version. */
export const COMMIT_SHA = process.env.EXPO_PUBLIC_COMMIT_SHA ?? '';

/** Set only when a deployment overrides the origin, null otherwise. Kept apart
 *  from WEB_APP_URL so label routing can tell an explicit choice from the
 *  default — see lib/label-origin.ts. */
export const WEB_URL_OVERRIDE = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/+$/, '') || null;

/** Origin the printed inventory QR codes point at. The web build reads its own
 *  origin instead; this is the fallback for native builds. */
export const WEB_APP_URL = WEB_URL_OVERRIDE ?? PRODUCTION_WEB_URL;

export type ReleaseChannel = 'beta' | 'release';

/** The beta website requests beta-only artifacts; production requests releases. */
export const RELEASE_CHANNEL: ReleaseChannel =
  process.env.EXPO_PUBLIC_RELEASE_CHANNEL === 'beta' || COMMIT_SHA ? 'beta' : 'release';

/** Whether Supabase credentials are present. When false, the app runs in an
 *  unconfigured state and shows setup guidance instead of crashing. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
