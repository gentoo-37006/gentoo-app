import { afterEach, describe, expect, it, vi } from 'vitest';
import { currentSeason, getEventDetails } from '@/lib/api/ftcscout';
import { eventDateRange, eventSeason, ftcScoutEventUrl } from '@/lib/ftcscout-event';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('currentSeason', () => {
  // FTC labels a season by the year it starts: the "2025" season runs from
  // kickoff in September 2025 through championships in spring 2026.
  it('uses the previous year before September', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toBe(2025); // January
    expect(currentSeason(new Date(2026, 6, 27))).toBe(2025); // July
    expect(currentSeason(new Date(2026, 7, 31))).toBe(2025); // August 31
  });

  it('rolls over at the September kickoff', () => {
    expect(currentSeason(new Date(2026, 8, 1))).toBe(2026); // September 1
    expect(currentSeason(new Date(2026, 11, 25))).toBe(2026); // December
  });

  it('keeps the same season across the new year', () => {
    expect(currentSeason(new Date(2026, 9, 1))).toBe(2026);
    expect(currentSeason(new Date(2027, 2, 1))).toBe(2026);
  });
});

describe('active event identity', () => {
  const now = new Date(2026, 10, 5);

  it('prefers the saved season even after season rollover', () => {
    expect(eventSeason({ season: 2024, last_synced: '2026-02-21T12:00:00Z' }, now)).toBe(2024);
  });

  it('infers the season of older settings from the last sync', () => {
    expect(eventSeason({ last_synced: '2026-02-21T12:00:00Z' }, now)).toBe(2025);
    expect(eventSeason({ last_synced: '2025-10-15T12:00:00Z' }, now)).toBe(2025);
  });

  it('uses the current season when no usable saved season or sync exists', () => {
    for (const setting of [null, {}, { last_synced: 'invalid' }, { season: '2025' }, { season: -1 }, { season: 2025.5 }]) {
      expect(eventSeason(setting, now)).toBe(2026);
    }
  });

  it('links to the selected season and encodes the event code as one path segment', () => {
    expect(ftcScoutEventUrl(2025, 'CAONCMP')).toBe('https://ftcscout.org/events/2025/CAONCMP');
    expect(ftcScoutEventUrl(2024, 'A/B ?#')).toBe('https://ftcscout.org/events/2024/A%2FB%20%3F%23');
  });
});

describe('event dates', () => {
  it('keeps date-only values on the event calendar day', () => {
    const day = (n: number) => new Date(2026, 1, n).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    expect(eventDateRange('2026-02-21', '2026-02-22')).toBe(`${day(21)} – ${day(22)}`);
    expect(eventDateRange('2026-02-21', '2026-02-21')).toBe(day(21));
  });

  it('handles missing and invalid dates without showing invalid text', () => {
    expect(eventDateRange(null, null)).toBe('');
    expect(eventDateRange('invalid', null)).toBe('');
    expect(eventDateRange('2026-02-21', null)).toBe(eventDateRange(null, '2026-02-21'));
  });
});

describe('getEventDetails', () => {
  it('requests metadata for the explicit event season', async () => {
    const event = { season: 2025, code: 'CAONCMP', name: 'Ontario Championship', start: '2026-02-21', end: '2026-02-22', venue: null, city: null, state: null, country: null };
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => event });
    vi.stubGlobal('fetch', fetch);
    await expect(getEventDetails('CAONCMP', 2025)).resolves.toEqual(event);
    expect(fetch).toHaveBeenCalledWith('https://api.ftcscout.org/rest/v1/events/2025/CAONCMP', { signal: expect.any(AbortSignal) });
  });

  it('reports HTTP errors instead of treating them as metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(getEventDetails('MISSING', 2025)).rejects.toThrow('Failed to fetch event details for MISSING: 404');
  });

  it('aborts a slow response and clears the timeout', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, { signal }: RequestInit) => new Promise((_resolve, reject) => {
      signal!.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })));
    const request = expect(getEventDetails('CAONCMP', 2025)).rejects.toThrow('timed out (Event details)');
    await vi.advanceTimersByTimeAsync(10000);
    await request;
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates connection failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')));
    await expect(getEventDetails('CAONCMP', 2025)).rejects.toThrow('Offline');
  });
});
