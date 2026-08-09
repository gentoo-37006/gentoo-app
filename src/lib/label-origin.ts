/**
 * Which origin a printed inventory QR label points at.
 *
 * Pure and platform-free so `npm test` (vitest, node env) covers it —
 * inventory-label.ts imports react-native and cannot be loaded there.
 */

export const PRODUCTION_WEB_URL = 'https://gentoo.ethanyanxu.com';

/** Mirrors BETA_HOST in app.config.js, which sets the Android App Link filter.
 *  The two must agree or beta labels stop opening the beta app. */
export const BETA_WEB_URL = 'https://beta.gentoo.ethanyanxu.com';

export type LabelOriginInput = {
  /** `Platform.OS`. */
  platform: string;
  /** Full package version, prerelease tag included (e.g. "1.6.0-beta.1"). */
  appVersion: string;
  /** EXPO_PUBLIC_WEB_URL, when the deployment set one. */
  override?: string | null;
};

/**
 * Android ships beta as a SEPARATE app (com.gentoo.app.beta) whose App Link
 * filter claims only the beta host — see app.config.js. A label encoding the
 * production host therefore can never open the beta app, so beta Android
 * labels point at the beta site instead.
 *
 * iOS is deliberately excluded. One bundle id claims BOTH domains there, and
 * the TestFlight build is the same binary that later ships to the App Store,
 * so a "-beta" version string does not mean a separate app the way it does on
 * Android. Encoding the beta host would bake a disposable domain into
 * permanent printed stickers and gain nothing.
 *
 * An explicit EXPO_PUBLIC_WEB_URL always wins — that is the escape hatch for
 * self-hosted deployments, and second-guessing it would break them.
 */
export function labelOrigin({ platform, appVersion, override }: LabelOriginInput): string {
  if (override) return override.replace(/\/+$/, '');
  if (platform === 'android' && appVersion.includes('-beta')) return BETA_WEB_URL;
  return PRODUCTION_WEB_URL;
}
