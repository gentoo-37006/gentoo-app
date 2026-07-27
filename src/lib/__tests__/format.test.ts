import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatDayLabel, formatTime, teamRecord, timeAgo } from '@/lib/format';

describe('timeAgo', () => {
  const NOW = new Date('2026-07-25T12:00:00Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const secondsAgo = (s: number) => new Date(NOW.getTime() - s * 1000).toISOString();

  it('buckets recent times', () => {
    expect(timeAgo(secondsAgo(10))).toBe('just now');
    expect(timeAgo(secondsAgo(44))).toBe('just now');
    expect(timeAgo(secondsAgo(120))).toBe('2m ago');
    expect(timeAgo(secondsAgo(2 * 3600))).toBe('2h ago');
    expect(timeAgo(secondsAgo(3 * 86400))).toBe('3d ago');
  });

  it('falls back to a locale date at a week or older', () => {
    const old = timeAgo(secondsAgo(8 * 86400));
    expect(old).not.toMatch(/ago$/);
    expect(old.length).toBeGreaterThan(0);
  });

  it('returns empty string for unparseable input', () => {
    expect(timeAgo('not-a-date')).toBe('');
  });
});

describe('formatDate / formatTime / formatDayLabel', () => {
  // Midday local time keeps the calendar day stable in any timezone.
  const ISO = '2026-06-22T12:00:00';

  it('formats a valid date compactly', () => {
    expect(formatDate(ISO)).toContain('22');
  });

  it('returns empty string for missing or invalid input', () => {
    expect(formatDate(null)).toBe('');
    expect(formatDate(undefined)).toBe('');
    expect(formatDate('garbage')).toBe('');
    expect(formatTime('garbage')).toBe('');
    expect(formatDayLabel('garbage')).toBe('');
  });

  it('formats time and day labels non-emptily for valid input', () => {
    expect(formatTime(ISO).length).toBeGreaterThan(0);
    expect(formatDayLabel(ISO)).toContain('22');
  });
});

describe('teamRecord', () => {
  it('formats a win-loss-tie record', () => {
    expect(teamRecord(8, 2, 1)).toBe('8-2-1');
  });

  it('shows a played-but-winless team as 0-0-0 rather than nothing', () => {
    expect(teamRecord(0, 0, 0)).toBe('0-0-0');
  });

  it('fills in missing parts of a partial record', () => {
    expect(teamRecord(3, null, null)).toBe('3-0-0');
  });

  it('returns null when the team has no synced record at all', () => {
    expect(teamRecord(null, null, null)).toBeNull();
    expect(teamRecord(undefined, undefined, undefined)).toBeNull();
  });
});
