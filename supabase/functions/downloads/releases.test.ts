import { describe, expect, it } from 'vitest';
import {
  buildDownloads,
  compareVersions,
  isStableRelease,
  parseVersion,
  pickChannelRelease,
  type GitHubRelease,
} from './releases';

/** A release carrying one real installer, so it clears the installer filter. */
function release(tag: string, extra: Partial<GitHubRelease> = {}): GitHubRelease {
  const version = tag.replace(/^v/, '');
  return {
    tag_name: tag,
    prerelease: /-/.test(tag),
    assets: [{ id: 1, name: `Gentoo-${version}-android.apk`, size: 100 }],
    ...extra,
  };
}

describe('compareVersions', () => {
  it('ranks a stable release above its own prereleases', () => {
    expect(compareVersions('v1.4.0', 'v1.4.0-beta.2')).toBeGreaterThan(0);
    expect(compareVersions('v1.4.0-beta.2', 'v1.4.0')).toBeLessThan(0);
  });

  it('orders release numbers before prerelease identifiers', () => {
    expect(compareVersions('v1.4.1-beta.1', 'v1.4.0')).toBeGreaterThan(0);
    expect(compareVersions('v1.5.0', 'v1.4.9')).toBeGreaterThan(0);
    expect(compareVersions('v2.0.0', 'v1.99.99')).toBeGreaterThan(0);
  });

  it('compares prerelease counters numerically, not as strings', () => {
    expect(compareVersions('v1.4.0-beta.10', 'v1.4.0-beta.9')).toBeGreaterThan(0);
    expect(compareVersions('v1.4.0-beta.2', 'v1.4.0-beta.1')).toBeGreaterThan(0);
  });

  it('ranks alpha below beta and a shorter prerelease below a longer one', () => {
    expect(compareVersions('v1.4.0-alpha.1', 'v1.4.0-beta.1')).toBeLessThan(0);
    expect(compareVersions('v1.4.0-beta.1', 'v1.4.0-beta')).toBeGreaterThan(0);
  });

  it('treats equal versions as equal and ignores build metadata', () => {
    expect(compareVersions('v1.4.0', '1.4.0')).toBe(0);
    expect(compareVersions('v1.4.0+build.7', 'v1.4.0')).toBe(0);
    expect(compareVersions('v1.4', 'v1.4.0')).toBe(0);
  });

  it('ranks an unparseable tag below anything parseable', () => {
    expect(compareVersions('nightly', 'v0.0.1')).toBeLessThan(0);
    expect(compareVersions('nightly', 'also-junk')).toBe(0);
  });
});

describe('parseVersion', () => {
  it('splits release numbers from prerelease identifiers', () => {
    expect(parseVersion('v1.4.0-beta.2')).toEqual({ release: [1, 4, 0], pre: ['beta', '2'] });
    expect(parseVersion('v1.4.0')).toEqual({ release: [1, 4, 0], pre: [] });
  });

  it('rejects things that are not versions', () => {
    expect(parseVersion('latest')).toBeNull();
    expect(parseVersion('')).toBeNull();
    expect(parseVersion(null)).toBeNull();
  });
});

describe('isStableRelease', () => {
  it('reads the tag, not just the GitHub flag', () => {
    expect(isStableRelease(release('v1.4.0'))).toBe(true);
    expect(isStableRelease(release('v1.4.0-beta.2'))).toBe(false);
  });

  it('honours the prerelease flag even on a stable-looking tag', () => {
    expect(isStableRelease(release('v1.4.0', { prerelease: true }))).toBe(false);
  });

  it('falls back to the flag when the tag is unparseable', () => {
    expect(isStableRelease({ tag_name: 'nightly', prerelease: false })).toBe(true);
    expect(isStableRelease({ tag_name: 'nightly', prerelease: true })).toBe(false);
  });
});

describe('pickChannelRelease', () => {
  // The reported bug: the beta site deployed at 1.4.0 was still offering
  // 1.4.0-beta.2 downloads.
  it('gives the beta channel a stable release that is newer than the newest beta', () => {
    const releases = [release('v1.4.0'), release('v1.4.0-beta.2'), release('v1.4.0-beta.1')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.4.0');
  });

  it('still prefers a prerelease once one lands ahead of stable', () => {
    const releases = [release('v1.5.0-beta.1'), release('v1.4.0'), release('v1.4.0-beta.2')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.5.0-beta.1');
  });

  it('does not walk the beta channel backwards when a patch ships after a beta', () => {
    // Published later than v1.5.0-beta.1, but older by version.
    const releases = [release('v1.4.1'), release('v1.5.0-beta.1')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.5.0-beta.1');
  });

  it('keeps prereleases out of the release channel', () => {
    const releases = [release('v1.5.0-beta.1'), release('v1.4.0'), release('v1.4.0-beta.2')];
    expect(pickChannelRelease(releases, 'release')?.tag_name).toBe('v1.4.0');
  });

  it('ignores drafts on both channels', () => {
    const releases = [release('v2.0.0', { draft: true }), release('v1.4.0')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.4.0');
    expect(pickChannelRelease(releases, 'release')?.tag_name).toBe('v1.4.0');
  });

  it('skips a release whose installers are not attached yet', () => {
    const pending: GitHubRelease = { tag_name: 'v1.5.0', assets: [{ id: 9, name: 'latest-mac.yml', size: 1 }] };
    const releases = [pending, release('v1.4.0')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.4.0');
    expect(pickChannelRelease(releases, 'release')?.tag_name).toBe('v1.4.0');
  });

  it('falls back to the newest beta when no stable release exists', () => {
    const releases = [release('v1.4.0-beta.2'), release('v1.4.0-beta.1')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.4.0-beta.2');
    expect(pickChannelRelease(releases, 'release')).toBeNull();
  });

  it('returns null rather than throwing when nothing qualifies', () => {
    expect(pickChannelRelease([], 'beta')).toBeNull();
    expect(pickChannelRelease([{ tag_name: 'v1.0.0' }], 'beta')).toBeNull();
  });

  it('is independent of the order GitHub returns', () => {
    const releases = [release('v1.4.0-beta.1'), release('v1.4.0'), release('v1.4.0-beta.2')];
    expect(pickChannelRelease(releases, 'beta')?.tag_name).toBe('v1.4.0');
  });
});

describe('buildDownloads', () => {
  it('picks the APK and skips the side files packaged beside it', () => {
    const built = buildDownloads({
      tag_name: 'v1.4.0',
      assets: [
        { id: 1, name: 'Gentoo-1.4.0-android.apk.blockmap', size: 1 },
        { id: 2, name: 'latest.yml', size: 1 },
        { id: 3, name: 'Gentoo-1.4.0-android.apk', size: 20 },
      ],
    });
    expect(built.map((d) => d.os)).toEqual(['Android']);
    expect(built[0].assetId).toBe(3);
  });

  // The desktop app was retired. Every historical release still carries its
  // dmg/exe/deb and electron-updater feeds; none may resurface as downloads.
  it('ignores the desktop installers left on historical releases', () => {
    const built = buildDownloads({
      tag_name: 'v1.3.0',
      assets: [
        { id: 1, name: 'Gentoo-1.3.0-mac-arm64.dmg', size: 10 },
        { id: 2, name: 'Gentoo-1.3.0-win-x64.exe', size: 10 },
        { id: 3, name: 'Gentoo-1.3.0-linux-amd64.deb', size: 10 },
        { id: 4, name: 'latest-mac.yml', size: 1 },
        { id: 5, name: 'Gentoo-1.3.0-android.apk', size: 20 },
      ],
    });
    expect(built.map((d) => d.os)).toEqual(['Android']);
    expect(built[0].assetId).toBe(5);
  });

  it('does not treat a desktop-only release as installable', () => {
    const desktopOnly: GitHubRelease = {
      tag_name: 'v1.3.0',
      assets: [
        { id: 1, name: 'Gentoo-1.3.0-mac-arm64.dmg', size: 10 },
        { id: 2, name: 'Gentoo-1.3.0-win-x64.exe', size: 10 },
      ],
    };
    expect(pickChannelRelease([desktopOnly], 'release')).toBeNull();
  });
});
