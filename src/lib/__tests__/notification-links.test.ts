import { describe, expect, it } from 'vitest';
import { hrefForNotification } from '@/lib/notification-links';

describe('hrefForNotification', () => {
  it('routes task notifications to the project board with a task param', () => {
    expect(
      hrefForNotification({ type: 'task', data: { projectId: 'p1', taskId: 't1' } })
    ).toBe('/projects/p1?task=t1');
  });

  it('routes task notifications without a taskId to the board alone', () => {
    expect(hrefForNotification({ type: 'task', data: { projectId: 'p1' } })).toBe(
      '/projects/p1'
    );
  });

  it('returns null for task notifications without a projectId', () => {
    expect(hrefForNotification({ type: 'task', data: {} })).toBeNull();
    expect(hrefForNotification({ type: 'task', data: null })).toBeNull();
  });

  it('routes assignment and report pings to the match they name', () => {
    expect(
      hrefForNotification({ type: 'assignment', data: { matchId: 'm1' } })
    ).toBe('/scouting/matches/m1');
    expect(
      hrefForNotification({ type: 'match_report', data: { matchId: 'm1', teamNumber: 7244 } })
    ).toBe('/scouting/matches/m1');
  });

  it('falls back to the match list when the ping names no match', () => {
    expect(hrefForNotification({ type: 'assignment', data: { matchId: 42 } })).toBe(
      '/scouting/matches'
    );
  });

  it('routes talkie, scouting, and approval types to their screens', () => {
    expect(hrefForNotification({ type: 'talkie_request' })).toBe('/talkie');
    expect(hrefForNotification({ type: 'talkie_claimed' })).toBe('/talkie');
    expect(hrefForNotification({ type: 'talkie_resolved' })).toBe('/talkie');
    expect(hrefForNotification({ type: 'assignment' })).toBe('/scouting/matches');
    expect(hrefForNotification({ type: 'match_report' })).toBe('/scouting/matches');
    expect(hrefForNotification({ type: 'approval' })).toBe('/admin');
  });

  it('reads the type from push data when no typed field exists', () => {
    expect(
      hrefForNotification({ data: { type: 'talkie_request' } })
    ).toBe('/talkie');
  });

  it('falls back to the task route for untyped payloads carrying a projectId', () => {
    expect(hrefForNotification({ data: { projectId: 'p1', taskId: 't1' } })).toBe(
      '/projects/p1?task=t1'
    );
  });

  it('stays put for general or unknown notifications', () => {
    expect(hrefForNotification({ type: 'general' })).toBeNull();
    expect(hrefForNotification({ type: 'something_new' })).toBeNull();
    expect(hrefForNotification({})).toBeNull();
  });

  it('ignores non-string ids', () => {
    expect(hrefForNotification({ type: 'task', data: { projectId: 42 } })).toBeNull();
  });
});
