// Supabase Edge Function: downloads
//
// Replaces the standalone gentoo-website. The source repo is private, so the
// browser can't read releases or fetch assets directly. This function holds the
// GitHub token server-side and:
//   - GET /functions/v1/downloads            -> JSON list of the latest installers
//   - GET /functions/v1/downloads?channel=beta -> JSON list of the latest beta installers
//   - GET /functions/v1/downloads?asset=<id> -> 302 to GitHub's signed asset URL
//
// Deploy it PUBLIC so plain <a> download links work (no auth header on a
// navigation):
//   supabase secrets set GITHUB_TOKEN=<pat-with-repo-read>
//   supabase functions deploy downloads --no-verify-jwt
//
// Optional: override the repo with GITHUB_REPO (defaults below).

const REPO = Deno.env.get('GITHUB_REPO') ?? 'gentoo-34755/gentoo-app';
type Channel = 'beta' | 'release';

type GitHubAsset = {
  id: number;
  name: string;
  size: number;
};

type GitHubRelease = {
  tag_name?: string;
  name?: string;
  body?: string;
  published_at?: string;
  prerelease?: boolean;
  draft?: boolean;
  assets?: GitHubAsset[];
};

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// The platforms we currently ship. First matching asset wins. Auxiliary
// electron-builder files (.blockmap, .yml, the updater .zip) never match.
const PLATFORMS: { os: 'Android' | 'macOS' | 'Windows'; label: string; arch: string; test: RegExp }[] = [
  { os: 'macOS', label: 'Apple Silicon', arch: 'arm64', test: /mac.*arm64\.dmg$/i },
  { os: 'Windows', label: '64-bit', arch: 'x64', test: /win.*x64.*\.exe$/i },
  { os: 'Android', label: 'APK installer', arch: 'apk', test: /(?:android|apk).*\.apk$/i },
];

function channelFromRequest(req: Request, url: URL): Channel {
  if (url.searchParams.get('channel') === 'beta') return 'beta';

  const source = `${req.headers.get('origin') ?? ''} ${req.headers.get('referer') ?? ''}`;
  return /\bbeta[.-]/i.test(source) ? 'beta' : 'release';
}

function releaseHasInstallers(release: GitHubRelease): boolean {
  return PLATFORMS.some((platform) => (release.assets ?? []).some((asset) => platform.test.test(asset.name)));
}

function isBetaRelease(release: GitHubRelease): boolean {
  const label = `${release.tag_name ?? ''} ${release.name ?? ''}`;
  return (
    (release.prerelease === true && /beta/i.test(label)) ||
    /-beta(?:[.-]|$)/i.test(label) ||
    (release.assets ?? []).some((asset) => /beta/i.test(asset.name))
  );
}

function buildDownloads(release: GitHubRelease) {
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

async function fetchLatestRelease(channel: Channel): Promise<GitHubRelease | null> {
  const path = channel === 'beta' ? 'releases?per_page=100' : 'releases/latest';
  const res = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: githubHeaders({ Accept: 'application/vnd.github+json' }),
  });
  if (!res.ok) return null;

  if (channel === 'release') return await res.json();

  const releases: GitHubRelease[] = await res.json();
  return releases.find((release) => !release.draft && isBetaRelease(release) && releaseHasInstallers(release)) ?? null;
}

function githubHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'gentoo-app',
    ...extra,
  };
  const token = Deno.env.get('GITHUB_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// ---- Release notes -----------------------------------------------------------
// GET …/downloads?notes=<app version>&channel=<c> -> { tag, title, notes, publishedAt }
// Looks up the release tagged v<version> first (exact match for the running
// build); falls back to the channel's latest release when that tag is missing
// (e.g. the desktop shell's date-stamped beta versions).
async function handleReleaseNotes(version: string, channel: Channel): Promise<Response> {
  let release: GitHubRelease | null = null;

  if (version) {
    try {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/releases/tags/v${encodeURIComponent(version)}`,
        { headers: githubHeaders({ Accept: 'application/vnd.github+json' }) }
      );
      if (res.ok) release = await res.json();
    } catch {
      release = null;
    }
  }

  if (!release) {
    try {
      release = await fetchLatestRelease(channel);
    } catch {
      release = null;
    }
  }

  if (!release) {
    return json({ tag: null, title: null, notes: null, publishedAt: null }, 404);
  }

  return json({
    tag: release.tag_name ?? null,
    title: release.name ?? release.tag_name ?? null,
    notes: release.body ?? null,
    publishedAt: release.published_at ?? null,
  });
}

// ---- electron-updater feed --------------------------------------------------
// The desktop app's generic update provider points here (see electron/main.cjs):
//   GET …/downloads/updates/<stable|beta>/latest[-mac].yml -> channel feed file
//   GET …/downloads/updates/<stable|beta>/<artifact>       -> 302 to signed URL
async function handleUpdates(channelSegment: string, file: string): Promise<Response> {
  const channel: Channel = channelSegment === 'beta' ? 'beta' : 'release';

  let release: GitHubRelease | null;
  try {
    release = await fetchLatestRelease(channel);
  } catch {
    release = null;
  }
  if (!release) {
    return new Response('No release available for this channel', { status: 404, headers: CORS });
  }
  const assets = release.assets ?? [];

  if (file.endsWith('.yml')) {
    // electron-updater always requests latest[-mac].yml (its channel is fixed to
    // "latest"); the published feed asset may be named latest-*.yml or beta-*.yml
    // depending on how electron-builder classified the version, so match by shape.
    const wantMac = /-mac\.yml$/i.test(file);
    const asset = assets.find((a) =>
      wantMac ? /^(latest|beta)-mac\.yml$/i.test(a.name) : /^(latest|beta)\.yml$/i.test(a.name)
    );
    if (!asset) {
      return new Response('Update feed file not found on the latest release', { status: 404, headers: CORS });
    }
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
      headers: githubHeaders({ Accept: 'application/octet-stream' }),
    });
    if (!res.ok) return new Response('Failed to fetch update feed', { status: 502, headers: CORS });
    return new Response(await res.text(), {
      headers: { ...CORS, 'Content-Type': 'text/yaml', 'Cache-Control': 'no-store' },
    });
  }

  const asset = assets.find((a) => a.name === file);
  if (!asset) return new Response('Update artifact not found', { status: 404, headers: CORS });

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${asset.id}`, {
    headers: githubHeaders({ Accept: 'application/octet-stream' }),
    redirect: 'manual',
  });
  const location = res.headers.get('location');
  if ((res.status === 301 || res.status === 302) && location) {
    return Response.redirect(location, 302);
  }
  return new Response('Update artifact not available', { status: 502, headers: CORS });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);

  // ---- Auto-update feed: /downloads/updates/<stable|beta>/<file> ------------
  const updatesMatch = url.pathname.match(/\/updates\/(stable|beta)\/([^/]+)$/);
  if (updatesMatch) {
    return handleUpdates(updatesMatch[1], decodeURIComponent(updatesMatch[2]));
  }

  const assetId = url.searchParams.get('asset');
  const channel = channelFromRequest(req, url);

  // ---- Release notes: ?notes=<version> ---------------------------------------
  const notesVersion = url.searchParams.get('notes');
  if (notesVersion !== null) {
    return handleReleaseNotes(notesVersion, channel);
  }

  // ---- Download: resolve an asset id to GitHub's short-lived signed URL ----
  if (assetId) {
    if (!/^\d+$/.test(assetId)) return new Response('Invalid asset id', { status: 400, headers: CORS });
    let res: Response;
    try {
      res = await fetch(`https://api.github.com/repos/${REPO}/releases/assets/${assetId}`, {
        headers: githubHeaders({ Accept: 'application/octet-stream' }),
        redirect: 'manual',
      });
    } catch {
      return new Response('Failed to reach GitHub', { status: 502, headers: CORS });
    }
    const location = res.headers.get('location');
    if ((res.status === 301 || res.status === 302) && location) {
      return Response.redirect(location, 302);
    }
    return new Response('Download not available', { status: 502, headers: CORS });
  }

  // ---- List: the latest channel's installers for the platforms we ship ----
  let release: GitHubRelease | null;
  try {
    release = await fetchLatestRelease(channel);
    if (!release) return json({ channel, version: null, publishedAt: null, downloads: [] });
  } catch {
    return json({ channel, version: null, publishedAt: null, downloads: [] });
  }

  return json({
    channel,
    version: release.tag_name ?? release.name ?? null,
    publishedAt: release.published_at ?? null,
    downloads: buildDownloads(release),
  });
});
