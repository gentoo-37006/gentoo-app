import { useQuery } from '@tanstack/react-query';
import {
  RELEASE_CHANNEL,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  isSupabaseConfigured,
  type ReleaseChannel,
} from '@/lib/env';
import { functionUrl } from '@/lib/function-url';

export type DownloadItem = {
  os: 'Android';
  label: string;
  arch: string;
  filename: string;
  size: number;
  assetId: number;
};

export type DownloadsResponse = {
  channel: ReleaseChannel;
  version: string | null;
  publishedAt: string | null;
  downloads: DownloadItem[];
};

/** Empty when unconfigured — see lib/function-url.ts. The query is gated on
 *  isSupabaseConfigured so the request is never made in that state. */
const ENDPOINT = functionUrl(SUPABASE_URL, 'downloads');
const DEFAULT_CHANNEL = RELEASE_CHANNEL;

/**
 * Direct download link for an asset. The function is public, but we pass the
 * anon key as a query param so the request clears the API gateway even on a
 * plain <a>/navigation (which can't set an Authorization header). The anon key
 * is already public in the client bundle.
 */
export function downloadUrl(assetId: number, channel: ReleaseChannel = DEFAULT_CHANNEL): string {
  return `${ENDPOINT}?asset=${assetId}&channel=${channel}&apikey=${SUPABASE_ANON_KEY}`;
}

export function useDownloads(channel: ReleaseChannel = DEFAULT_CHANNEL) {
  return useQuery({
    queryKey: ['downloads', channel],
    enabled: isSupabaseConfigured,
    queryFn: async (): Promise<DownloadsResponse> => {
      const res = await fetch(`${ENDPOINT}?channel=${channel}`, {
        headers: { Accept: 'application/json', apikey: SUPABASE_ANON_KEY },
      });
      if (!res.ok) throw new Error('Failed to load downloads');
      return res.json();
    },
    staleTime: 5 * 60_000,
  });
}

export function formatSize(bytes: number): string {
  const mb = bytes / 1024 / 1024;
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${Math.round(mb)} MB`;
}
