import type { Session } from '@supabase/supabase-js';

/** Read only the SDK's persisted session, never a second copy of its tokens. */
export function parseStoredSession(raw: string | null): Session | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.access_token !== 'string' || !value.access_token ||
        typeof value.refresh_token !== 'string' || !value.refresh_token ||
        typeof value.user?.id !== 'string' || !value.user.id ||
        typeof value.expires_at !== 'number' || !Number.isFinite(value.expires_at)) return null;
    return value as Session;
  } catch { return null; }
}

/** Bound network waits while preserving a caller's cancellation signal. */
export async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : null);
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort);
  const timer = setTimeout(abort, 8_000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
