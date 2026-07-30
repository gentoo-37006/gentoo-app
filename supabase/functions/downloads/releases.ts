// Release selection for the downloads function.
//
// Kept out of index.ts — that module calls Deno.env / Deno.serve at import
// time, so it can't be pulled into vitest. Everything here is pure and tested
// in releases.test.ts.

export type GitHubAsset = {
  id: number;
  name: string;
  size: number;
};

export type GitHubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
};

export type Channel = 'beta' | 'release';

// The platforms we currently ship. First matching asset wins. Desktop
// installers and their electron-builder side files (.dmg, .exe, .deb,
// .blockmap, .yml) never match — the desktop app was retired, and historical
// releases still carry those assets.
export const PLATFORMS: {
  os: 'Android';
  label: string;
  arch: string;
  test: RegExp;
}[] = [{ os: 'Android', label: 'APK installer', arch: 'apk', test: /(?:android|apk).*\.apk$/i }];

export function releaseHasInstallers(release: GitHubRelease): boolean {
  return PLATFORMS.some((platform) => (release.assets ?? []).some((asset) => platform.test.test(asset.name)));
}

/** The tag is authoritative; the display name is only a fallback. */
export function versionLabel(release: GitHubRelease): string {
  return release.tag_name ?? release.name ?? '';
}

// v1.4.0, v1.4.0-beta.2, 1.4, v1.4.0+build.7 — build metadata is ignored, as
// semver says it must be.
const VERSION_RE = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/;

export type ParsedVersion = { release: [number, number, number]; pre: string[] };

export function parseVersion(tag: string | null | undefined): ParsedVersion | null {
  if (!tag) return null;
  const match = VERSION_RE.exec(tag.trim());
  if (!match) return null;
  return {
    release: [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)],
    pre: match[4] ? match[4].split('.') : [],
  };
}

/** Semver prerelease precedence: numeric identifiers rank below alphanumeric
 *  ones, and when every shared identifier ties the longer list wins. */
function comparePrerelease(a: string[], b: string[]): number {
  // A release with no prerelease outranks any prerelease of the same version:
  // 1.4.0 > 1.4.0-beta.2. This is the whole point of the file.
  if (!a.length && !b.length) return 0;
  if (!a.length) return 1;
  if (!b.length) return -1;

  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const left = a[i];
    const right = b[i];
    if (left === undefined) return -1;
    if (right === undefined) return 1;

    const leftNumeric = /^\d+$/.test(left);
    const rightNumeric = /^\d+$/.test(right);
    if (leftNumeric && rightNumeric) {
      if (Number(left) !== Number(right)) return Number(left) < Number(right) ? -1 : 1;
      continue;
    }
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
    if (left !== right) return left < right ? -1 : 1;
  }
  return 0;
}

/** <0, 0, >0 — an unparseable tag ranks below every parseable one. */
export function compareVersions(a: string | null | undefined, b: string | null | undefined): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;

  for (let i = 0; i < 3; i++) {
    if (left.release[i] !== right.release[i]) return left.release[i] < right.release[i] ? -1 : 1;
  }
  return comparePrerelease(left.pre, right.pre);
}

export function isStableRelease(release: GitHubRelease): boolean {
  if (release.prerelease === true) return false;
  const parsed = parseVersion(versionLabel(release));
  // Unparseable tag: trust GitHub's own prerelease flag rather than dropping
  // the release on the floor.
  if (!parsed) return true;
  return parsed.pre.length === 0;
}

/**
 * The newest release a channel should serve.
 *
 * `release` takes stable builds only. `beta` takes the newest build of EITHER
 * kind: between prereleases the beta site runs the current stable version, and
 * offering v1.4.0-beta.2 to someone already on v1.4.0 is a downgrade. Ordering
 * is by version, not publish date, so shipping a v1.4.1 patch after
 * v1.5.0-beta.1 doesn't drag the beta channel backwards.
 *
 * Releases without installers are skipped in both channels — a tag published
 * before its assets finish uploading would otherwise render an empty page.
 */
export function pickChannelRelease(releases: GitHubRelease[], channel: Channel): GitHubRelease | null {
  const usable = releases.filter((release) => !release.draft && releaseHasInstallers(release));
  const candidates = channel === 'release' ? usable.filter(isStableRelease) : usable;

  let best: GitHubRelease | null = null;
  for (const release of candidates) {
    // Ties keep the earlier entry — GitHub lists releases newest-first.
    if (!best || compareVersions(versionLabel(release), versionLabel(best)) > 0) best = release;
  }
  return best;
}

export function buildDownloads(release: GitHubRelease) {
  const downloads = [];
  for (const platform of PLATFORMS) {
    const asset = (release.assets ?? []).find((a) => platform.test.test(a.name));
    if (!asset) continue;
    downloads.push({
      os: platform.os,
      label: platform.label,
      arch: platform.arch,
      filename: asset.name,
      size: asset.size,
      assetId: asset.id,
    });
  }
  return downloads;
}
