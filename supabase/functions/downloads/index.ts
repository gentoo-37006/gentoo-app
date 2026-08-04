// Supabase Edge Function: downloads
//
// Replaces the standalone gentoo-website. The source repo is private, so the
// browser can't read releases or fetch assets directly. This function holds the
// GitHub token server-side and:
//   - GET /functions/v1/downloads            -> JSON list of the latest installers
//   - GET /functions/v1/downloads?channel=beta -> JSON list of the newest installers,
//                                                 prerelease or stable, whichever is newer
//   - GET /functions/v1/downloads?asset=<id> -> 302 to GitHub's signed asset URL
//
// Deploy it PUBLIC so plain <a> download links work (no auth header on a
// navigation):
//   supabase secrets set GITHUB_TOKEN=<pat-with-repo-read>
//   supabase functions deploy downloads --no-verify-jwt
//
// Optional: override the repo with GITHUB_REPO (defaults below).

import {
  buildDownloads,
  pickChannelRelease,
  type Channel,
  type GitHubRelease,
} from './releases.ts';

const REPO = Deno.env.get('GITHUB_REPO') ?? 'gentoo-37006/gentoo-app';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function channelFromRequest(req: Request, url: URL): Channel {
  if (url.searchParams.get('channel') === 'beta') return 'beta';

  const source = `${req.headers.get('origin') ?? ''} ${req.headers.get('referer') ?? ''}`;
  return /\bbeta[.-]/i.test(source) ? 'beta' : 'release';
}

// Both channels select from the same listing: `releases/latest` can't express
// "newest of either kind", and it also can't skip a release whose installers
// haven't finished uploading. See pickChannelRelease for the rules.
async function fetchLatestRelease(channel: Channel): Promise<GitHubRelease | null> {
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, {
    headers: githubHeaders({ Accept: 'application/vnd.github+json' }),
  });
  if (!res.ok) return null;

  const releases: GitHubRelease[] = await res.json();
  return pickChannelRelease(releases, channel);
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
// build); falls back to the channel's latest release when that tag is missing.
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);

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
