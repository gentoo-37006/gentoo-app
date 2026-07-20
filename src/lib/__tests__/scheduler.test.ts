import { describe, expect, it } from 'vitest';
import { generateSchedule } from '@/lib/scheduler';

const T0 = new Date('2026-07-25T09:00:00Z');
const at = (minutes: number) => new Date(T0.getTime() + minutes * 60_000);

describe('generateSchedule', () => {
  it('returns nothing for degenerate inputs', () => {
    const base = { start: T0, end: at(120), shiftMinutes: 30, peoplePerShift: 1 };
    expect(generateSchedule({ ...base, memberIds: [] })).toEqual([]);
    expect(generateSchedule({ ...base, memberIds: ['a'], shiftMinutes: 0 })).toEqual([]);
    expect(generateSchedule({ ...base, memberIds: ['a'], peoplePerShift: 0 })).toEqual([]);
    expect(
      generateSchedule({ ...base, start: at(120), end: T0, memberIds: ['a'] })
    ).toEqual([]);
  });

  it('splits the window into consecutive fixed-length slots', () => {
    const shifts = generateSchedule({
      start: T0,
      end: at(120),
      shiftMinutes: 30,
      peoplePerShift: 1,
      memberIds: ['a', 'b', 'c', 'd'],
    });
    expect(shifts).toHaveLength(4);
    shifts.forEach((s, i) => {
      expect(s.start).toEqual(at(i * 30));
      expect(s.end).toEqual(at((i + 1) * 30));
    });
  });

  it('drops a trailing partial slot instead of overrunning the end time', () => {
    const shifts = generateSchedule({
      start: T0,
      end: at(70),
      shiftMinutes: 30,
      peoplePerShift: 1,
      memberIds: ['a', 'b'],
    });
    expect(shifts).toHaveLength(2);
    expect(shifts[1].end).toEqual(at(60));
  });

  it('caps people per shift at the roster size', () => {
    const shifts = generateSchedule({
      start: T0,
      end: at(30),
      shiftMinutes: 30,
      peoplePerShift: 5,
      memberIds: ['a', 'b'],
    });
    expect(shifts).toHaveLength(2);
    expect(new Set(shifts.map((s) => s.assigneeId))).toEqual(new Set(['a', 'b']));
  });

  it('alternates two members instead of assigning back-to-back shifts', () => {
    const shifts = generateSchedule({
      start: T0,
      end: at(120),
      shiftMinutes: 30,
      peoplePerShift: 1,
      memberIds: ['a', 'b'],
    });
    expect(shifts.map((s) => s.assigneeId)).toEqual(['a', 'b', 'a', 'b']);
  });

  it('keeps total assigned time fair across the team', () => {
    const memberIds = ['a', 'b', 'c', 'd', 'e'];
    const shifts = generateSchedule({
      start: T0,
      end: at(6 * 60),
      shiftMinutes: 20,
      peoplePerShift: 2,
      memberIds,
    });
    const minutes = new Map(memberIds.map((id) => [id, 0]));
    for (const s of shifts) {
      minutes.set(s.assigneeId, (minutes.get(s.assigneeId) ?? 0) + 20);
    }
    const totals = [...minutes.values()];
    // 18 slots × 2 people = 36 assignments over 5 members: 720 total minutes.
    expect(totals.reduce((a, b) => a + b, 0)).toBe(720);
    expect(Math.max(...totals) - Math.min(...totals)).toBeLessThanOrEqual(20);
  });
});
