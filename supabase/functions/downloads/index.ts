// Supabase Edge Function: downloads
//
// Replaces the standalone gentoo-website. The source repo is private, so the
// browser can't read releases or fetch assets directly. This function holds the
// GitHub token server-side and:
//   - GET /functions/v1/downloads            -> JSON list of the latest installers
//   - GET /functions/v1/downloads?asset=<id> -> 302 to GitHub's signed asset URL
//
// Deploy it PUBLIC so plain <a> download links work (no auth header on a
// navigation):
//   supabase secrets set GITHUB_TOKEN=<pat-with-repo-read>
//   supabase functions deploy downloads --no-verify-jwt
//
// Optional: override the repo with GITHUB_REPO (defaults below).

const REPO = Deno.env.get('GITHUB_REPO') ?? 'gentoo-34755/gentoo-app';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

// The platforms we currently ship. First matching asset wins. Auxiliary
// electron-builder files (.blockmap, .yml, the updater .zip) never match.
const PLATFORMS: { os: 'macOS' | 'Windows'; label: string; arch: string; test: RegExp }[] = [
  { os: 'macOS', label: 'Apple Silicon', arch: 'arm64', test: /mac.*arm64\.dmg$/i },
  { os: 'Windows', label: '64-bit', arch: 'x64', test: /win.*x64.*\.exe$/i },
];

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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });

  const url = new URL(req.url);
  const assetId = url.searchParams.get('asset');

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

  // ---- List: the latest release's installers for the platforms we ship ----
  let release: { tag_name?: string; name?: string; published_at?: string; assets?: { id: number; name: string; size: number }[] };
  try {
    const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: githubHeaders({ Accept: 'application/vnd.github+json' }),
    });
    if (!res.ok) return json({ version: null, publishedAt: null, downloads: [] });
    release = await res.json();
  } catch {
    return json({ version: null, publishedAt: null, downloads: [] });
  }

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

  return json({
    version: release.tag_name ?? release.name ?? null,
    publishedAt: release.published_at ?? null,
    downloads,
  });
});
