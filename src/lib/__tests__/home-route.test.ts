import { describe, expect, it } from 'vitest';
import { homeRoute } from '@/lib/home-route';

describe('event-day home route', () => {
  const event = { start: '2026-11-10', end: '2026-11-12' };

  it('opens Competition throughout every event day, including both endpoints', () => {
    expect(homeRoute(event, new Date(2026, 10, 10, 0, 0))).toBe('/competition');
    expect(homeRoute(event, new Date(2026, 10, 11, 12))).toBe('/competition');
    expect(homeRoute(event, new Date(2026, 10, 12, 23, 59, 59))).toBe('/competition');
  });

  it('opens Dashboard before and after the event, even when an event is configured', () => {
    expect(homeRoute(event, new Date(2026, 10, 9, 23, 59))).toBe('/dashboard');
    expect(homeRoute(event, new Date(2026, 10, 13, 0, 0))).toBe('/dashboard');
  });

  it('uses the device calendar day, without shifting date-only values to the previous day', () => {
    const now = new Date(2026, 10, 10, 0, 1);
    expect(homeRoute({ start: '2026-11-10', end: '2026-11-10' }, now)).toBe('/competition');
    expect(homeRoute({ start: '2026-11-10T00:00:00Z', end: '2026-11-10T00:00:00Z' }, now)).toBe('/competition');
  });

  it('handles a single-day event with no end date', () => {
    expect(homeRoute({ start: '2026-11-10', end: null }, new Date(2026, 10, 10))).toBe('/competition');
    expect(homeRoute({ start: '2026-11-10', end: null }, new Date(2026, 10, 11))).toBe('/dashboard');
  });

  it('handles events spanning a year boundary', () => {
    const yearEnd = { start: '2026-12-31', end: '2027-01-02' };
    expect(homeRoute(yearEnd, new Date(2027, 0, 1))).toBe('/competition');
    expect(homeRoute(yearEnd, new Date(2027, 0, 3))).toBe('/dashboard');
  });

  it('safely opens Dashboard when dates are unavailable or invalid', () => {
    for (const dates of [null, undefined, { start: null, end: null },
      { start: 'invalid', end: '2026-11-10' }, { start: '2026-02-30', end: null },
      { start: '2026-11-10', end: 'invalid' }, { start: '2026-11-12', end: '2026-11-10' }]) {
      expect(homeRoute(dates, new Date(2026, 10, 10))).toBe('/dashboard');
    }
    expect(homeRoute(event, new Date('invalid'))).toBe('/dashboard');
  });
});
