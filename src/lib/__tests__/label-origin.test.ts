import { describe, expect, it } from 'vitest';
import { BETA_WEB_URL, PRODUCTION_WEB_URL, labelOrigin } from '@/lib/label-origin';

const origin = (platform: string, appVersion: string, override?: string | null) =>
  labelOrigin({ platform, appVersion, override });

describe('labelOrigin', () => {
  it('points beta Android labels at the beta site', () => {
    // com.gentoo.app.beta's App Link filter claims ONLY this host, so a
    // production URL here would never open the app it was printed from.
    expect(origin('android', '1.6.0-beta.1')).toBe(BETA_WEB_URL);
  });

  it('leaves release Android labels on production', () => {
    expect(origin('android', '1.6.0')).toBe(PRODUCTION_WEB_URL);
  });

  it('keeps iOS on production even for a beta version', () => {
    // One bundle id claims both domains and the TestFlight binary is the one
    // that ships, so "-beta" does not mean a separate app the way it does on
    // Android. Printed stickers outlive the beta channel.
    expect(origin('ios', '1.6.0-beta.1')).toBe(PRODUCTION_WEB_URL);
  });

  it('keeps iOS on production for a release version', () => {
    expect(origin('ios', '1.6.0')).toBe(PRODUCTION_WEB_URL);
  });

  it('honours an explicit override on every platform', () => {
    // Self-hosted deployments set EXPO_PUBLIC_WEB_URL; overriding their choice
    // would silently point their labels at someone else's server.
    expect(origin('android', '1.6.0-beta.1', 'https://parts.example.org')).toBe(
      'https://parts.example.org'
    );
    expect(origin('ios', '1.6.0', 'https://parts.example.org')).toBe('https://parts.example.org');
  });

  it('trims a trailing slash off the override', () => {
    expect(origin('ios', '1.6.0', 'https://parts.example.org/')).toBe('https://parts.example.org');
  });

  it('ignores an empty override rather than producing a relative URL', () => {
    expect(origin('android', '1.6.0-beta.1', '')).toBe(BETA_WEB_URL);
    expect(origin('ios', '1.6.0', null)).toBe(PRODUCTION_WEB_URL);
  });

  it('matches any prerelease tag, not just beta.1', () => {
    expect(origin('android', '1.7.0-beta.4')).toBe(BETA_WEB_URL);
    expect(origin('android', '2.0.0-beta.10')).toBe(BETA_WEB_URL);
  });

  it('does not treat semver build metadata as the beta channel', () => {
    // The Android package split keys off the same "-beta" substring, so these
    // two must agree on what counts. app.config.js uses includes('-beta'), and
    // "1.6.0+beta" is a RELEASE build — it would ship as com.gentoo.app, whose
    // filter claims the production host.
    expect(origin('android', '1.6.0+beta')).toBe(PRODUCTION_WEB_URL);
  });
});
