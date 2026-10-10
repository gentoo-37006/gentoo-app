import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchWithTimeout, parseStoredSession } from '../auth-startup';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('auth startup', () => {
  it('restores the existing session even when its token needs online refresh', () => {
    const session = { access_token: 'access', refresh_token: 'refresh', expires_at: 1, user: { id: 'max' } };
    expect(parseStoredSession(JSON.stringify(session))).toEqual(session);
  });
  it('rejects absent, malformed, and incomplete sessions', () => {
    for (const raw of [null, 'bad', '{}', 'null', '{"user":{"id":"max"}}']) {
      expect(parseStoredSession(raw)).toBeNull();
    }
  });
  it('aborts a request that never responds', async () => {
    vi.useFakeTimers();
    let signal: AbortSignal | undefined;
    vi.stubGlobal('fetch', vi.fn((_input, init) => {
      signal = init.signal;
      return new Promise((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted'))));
    }));
    const result = expect(fetchWithTimeout('https://example.test')).rejects.toThrow('aborted');
    await vi.advanceTimersByTimeAsync(8_000);
    await result;
    expect(signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('preserves caller cancellation and clears the deadline after success', async () => {
    vi.useFakeTimers();
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal('fetch', vi.fn(async (_input, init) => {
      expect(init.signal.aborted).toBe(true);
      return new Response('ok');
    }));
    await fetchWithTimeout('https://example.test', { signal: controller.signal });
    expect(vi.getTimerCount()).toBe(0);
  });
});
