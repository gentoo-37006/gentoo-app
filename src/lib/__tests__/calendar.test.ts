import { describe, expect, it } from 'vitest';
import { DAYS_PER_WEEK, WEEKS_SHOWN, calendarWeeks } from '@/lib/calendar';

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

describe('calendarWeeks', () => {
  it('always returns six rows of seven days', () => {
    for (const month of [new Date(2026, 7, 1), new Date(2026, 1, 1), new Date(2027, 0, 1)]) {
      const weeks = calendarWeeks(month);
      expect(weeks).toHaveLength(WEEKS_SHOWN);
      for (const week of weeks) expect(week).toHaveLength(DAYS_PER_WEEK);
    }
  });

  it('puts every day in its real weekday column', () => {
    // The regression: the grid used to wrap at 6 cells, so each date rendered
    // one column left of where it belongs.
    for (const week of calendarWeeks(new Date(2026, 7, 1))) {
      week.forEach((date, column) => expect(date.getDay()).toBe(column));
    }
  });

  it('pads the first week for a month starting on Saturday', () => {
    // August 2026 starts on a Saturday, so the first row is six July days
    // and Aug 1 sits in the final (Sa) column.
    const [firstWeek] = calendarWeeks(new Date(2026, 7, 1));

    expect(firstWeek.map(iso)).toEqual([
      '2026-07-26',
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
      '2026-08-01',
    ]);
  });

  it('needs no padding when a month starts on Sunday', () => {
    // February 2026 starts on a Sunday.
    const [firstWeek] = calendarWeeks(new Date(2026, 1, 1));

    expect(iso(firstWeek[0])).toBe('2026-02-01');
    expect(firstWeek[0].getDay()).toBe(0);
  });

  it('runs continuously with no gaps or repeats across rows', () => {
    const days = calendarWeeks(new Date(2026, 7, 1)).flat();

    for (let i = 1; i < days.length; i += 1) {
      const gap = (days[i].getTime() - days[i - 1].getTime()) / 86_400_000;
      expect(Math.round(gap)).toBe(1);
    }
  });

  it('covers the whole month it is asked for', () => {
    const month = new Date(2026, 7, 1);
    const shown = new Set(calendarWeeks(month).flat().map(iso));

    for (let day = 1; day <= 31; day += 1) {
      expect(shown.has(`2026-08-${String(day).padStart(2, '0')}`)).toBe(true);
    }
  });

  it('handles a 31-day month starting late enough to need all six rows', () => {
    // May 2027 starts on a Saturday: 6 leading days + 31 = 37 cells, so the
    // sixth row is doing real work rather than being all trailing days.
    const weeks = calendarWeeks(new Date(2027, 4, 1));

    expect(weeks[0][6].getDate()).toBe(1);
    expect(weeks.flat().filter((d) => d.getMonth() === 4)).toHaveLength(31);
  });
});
