import { useQuery } from '@tanstack/react-query';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';

export type DownloadItem = {
  os: 'macOS' | 'Windows';
  label: string;
  arch: string;
  filename: string;
  size: number;
  assetId: number;
};

export type DownloadsResponse = {
  version: string | null;
  publishedAt: string | null;
  downloads: DownloadItem[];
};

const ENDPOINT = `${SUPABASE_URL}/functions/v1/downloads`;

/**
 * Direct download link for an asset. The function is public, but we pass the
 * anon key as a query param so the request clears the API gateway even on a
 * plain <a>/navigation (which can't set an Authorization header). The anon key
 * is already public in the client bundle.
 */
export function downloadUrl(assetId: number): string {
  return `${ENDPOINT}?asset=${assetId}&apikey=${SUPABASE_ANON_KEY}`;
}

export function useDownloads() {
  return useQuery({
    queryKey: ['downloads'],
    queryFn: async (): Promise<DownloadsResponse> => {
      const res = await fetch(ENDPOINT, {
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
