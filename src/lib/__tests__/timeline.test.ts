import { describe, expect, it } from 'vitest';
import {
  buildTimeline,
  dayNumber,
  dayToValue,
  deadlineSummary,
  itemDateLabel,
  localDayNumber,
  relativeDueLabel,
  timelineHeader,
  timelineItem,
  upcomingDeadlines,
  weekdayIndex,
  type TimelineProjectInput,
  type TimelineTaskInput,
} from '@/lib/timeline';

const TODAY = dayNumber('2026-11-25')!; // a Wednesday

function task(overrides: Partial<TimelineTaskInput> & { id: string }): TimelineTaskInput {
  return {
    project_id: 'p1',
    title: overrides.id,
    status: 'todo',
    priority: 'medium',
    assignee_ids: [],
    start_date: null,
    due_date: null,
    sort_order: 0,
    created_at: '2026-11-01T00:00:00Z',
    ...overrides,
  };
}

const PROJECTS: TimelineProjectInput[] = [
  { id: 'p2', name: 'Robot', status: 'active', sort_order: 10 },
  { id: 'p1', name: 'Outreach', status: 'planning', sort_order: 0 },
  { id: 'p3', name: 'Empty', status: 'planning', sort_order: 20 },
];

describe('day numbers', () => {
  it('round-trips a calendar date', () => {
    expect(dayToValue(dayNumber('2026-11-25')!)).toBe('2026-11-25');
    expect(dayNumber('2026-11-25T23:30:00-05:00')).toBe(dayNumber('2026-11-25'));
  });

  it('rejects missing or malformed values', () => {
    expect(dayNumber(null)).toBeNull();
    expect(dayNumber('')).toBeNull();
    expect(dayNumber('next week')).toBeNull();
  });

  it('counts across a daylight-saving change as whole days', () => {
    // Clocks went back in North America on 2026-11-01.
    expect(dayNumber('2026-11-02')! - dayNumber('2026-10-31')!).toBe(2);
  });

  it('reads the local calendar date', () => {
    expect(localDayNumber(new Date(2026, 10, 25, 23, 59))).toBe(TODAY);
  });

  it('knows the weekday', () => {
    expect(weekdayIndex(TODAY)).toBe(2); // Wednesday
    expect(weekdayIndex(dayNumber('2026-11-23')!)).toBe(0); // Monday
    expect(weekdayIndex(dayNumber('1969-12-28')!)).toBe(6); // Sunday, before day 0
  });
});

describe('timelineItem', () => {
  it('draws a start and due date as a bar', () => {
    const item = timelineItem(task({ id: 'a', start_date: '2026-11-20', due_date: '2026-11-30' }), TODAY);
    expect(item).toMatchObject({ kind: 'range', start: dayNumber('2026-11-20'), end: dayNumber('2026-11-30') });
  });

  it('swaps a start that falls after the due date', () => {
    const item = timelineItem(task({ id: 'a', start_date: '2026-12-05', due_date: '2026-12-01' }), TODAY);
    expect(item).toMatchObject({ start: dayNumber('2026-12-01'), end: dayNumber('2026-12-05') });
  });

  it('draws a due date alone as a milestone and a start alone as one day', () => {
    expect(timelineItem(task({ id: 'a', due_date: '2026-12-01' }), TODAY)?.kind).toBe('milestone');
    expect(timelineItem(task({ id: 'a', start_date: '2026-12-01' }), TODAY)?.kind).toBe('start');
  });

  it('leaves out a task with no dates, including rows from before the start_date column', () => {
    expect(timelineItem(task({ id: 'a' }), TODAY)).toBeNull();
    const legacy = task({ id: 'b' });
    delete legacy.start_date;
    expect(timelineItem(legacy, TODAY)).toBeNull();
  });

  it('marks open tasks past their due date as overdue, but not done ones', () => {
    expect(timelineItem(task({ id: 'a', due_date: '2026-11-24' }), TODAY)?.overdue).toBe(true);
    expect(timelineItem(task({ id: 'a', due_date: '2026-11-25' }), TODAY)?.overdue).toBe(false);
    expect(timelineItem(task({ id: 'a', due_date: '2026-11-24', status: 'done' }), TODAY)?.overdue).toBe(false);
  });
});

describe('buildTimeline', () => {
  const tasks = [
    task({ id: 'late', project_id: 'p2', start_date: '2026-12-10', due_date: '2026-12-20' }),
    task({ id: 'early', project_id: 'p2', due_date: '2026-11-28' }),
    task({ id: 'nodate', project_id: 'p2' }),
    task({ id: 'mine', project_id: 'p1', due_date: '2026-11-26', assignee_ids: ['me'] }),
    task({ id: 'done', project_id: 'p1', due_date: '2026-11-10', status: 'done' }),
  ];

  it('groups by project in list order and sorts tasks by date', () => {
    const model = buildTimeline(tasks, PROJECTS, { today: TODAY });
    expect(model.groups.map((g) => g.project.id)).toEqual(['p1', 'p2']);
    expect(model.groups[1].items.map((i) => i.id)).toEqual(['early', 'late']);
    expect(model.groups[1].unscheduled).toBe(1);
    expect(model.unscheduled).toBe(1);
  });

  it('spans each project from its first to its last scheduled day', () => {
    const model = buildTimeline(tasks, PROJECTS, { today: TODAY });
    expect(model.groups[1].span).toEqual({ start: dayNumber('2026-11-28'), end: dayNumber('2026-12-20') });
  });

  it('starts the range on a Monday and ends it on a Sunday', () => {
    const { range } = buildTimeline(tasks, PROJECTS, { today: TODAY });
    expect(weekdayIndex(range.start)).toBe(0);
    expect(weekdayIndex(range.end)).toBe(6);
    expect(range.start).toBeLessThanOrEqual(TODAY - 14);
    expect(range.end).toBeGreaterThanOrEqual(TODAY + 70);
  });

  it('stretches to far tasks, up to a limit', () => {
    const far = [task({ id: 'far', due_date: '2027-08-01' }), task({ id: 'farther', due_date: '2030-01-01' })];
    const { range } = buildTimeline(far, PROJECTS, { today: TODAY });
    expect(range.end).toBeGreaterThanOrEqual(dayNumber('2027-08-01')!);
    expect(range.end).toBeLessThan(TODAY + 410);
  });

  it('filters to one assignee and hides done tasks', () => {
    expect(
      buildTimeline(tasks, PROJECTS, { today: TODAY, assigneeId: 'me' }).groups.flatMap((g) => g.items.map((i) => i.id))
    ).toEqual(['mine']);
    expect(
      buildTimeline(tasks, PROJECTS, { today: TODAY, hideDone: true }).groups[0].items.map((i) => i.id)
    ).toEqual(['mine']);
  });

  it('leaves out projects with no matching tasks', () => {
    expect(buildTimeline([], PROJECTS, { today: TODAY }).groups).toEqual([]);
  });
});

describe('timelineHeader', () => {
  const range = { start: dayNumber('2026-11-23')!, end: dayNumber('2026-12-06')! };

  it('labels every day under month bands at week zoom', () => {
    const { top, ticks } = timelineHeader(range, 'weeks');
    expect(top.map((b) => b.label)).toEqual(['November 2026', 'December 2026']);
    expect(top[0].end).toBe(dayNumber('2026-11-30'));
    expect(ticks).toHaveLength(14);
    expect(ticks[5]).toMatchObject({ label: '28', weekend: true });
  });

  it('labels week starts at month zoom', () => {
    expect(timelineHeader(range, 'months').ticks.map((t) => t.label)).toEqual(['23', '30']);
  });

  it('labels months under years at quarter zoom', () => {
    const wide = { start: dayNumber('2026-11-23')!, end: dayNumber('2027-02-07')! };
    const { top, ticks } = timelineHeader(wide, 'quarters');
    expect(top.map((b) => b.label)).toEqual(['2026', '2027']);
    expect(ticks.map((t) => t.label)).toEqual(['Nov', 'Dec', 'Jan', 'Feb']);
  });
});

describe('labels', () => {
  it('describes an item by its dates', () => {
    expect(itemDateLabel({ kind: 'milestone', start: TODAY, end: TODAY }, TODAY)).toBe('Due Nov 25');
    expect(itemDateLabel({ kind: 'start', start: TODAY, end: TODAY }, TODAY)).toBe('Starts Nov 25');
    expect(itemDateLabel({ kind: 'range', start: TODAY, end: TODAY + 9 }, TODAY)).toBe('Nov 25 – Dec 4');
    expect(itemDateLabel({ kind: 'range', start: TODAY, end: TODAY + 60 }, TODAY)).toBe('Nov 25 – Jan 24, 2027');
  });

  it('says how far away a deadline is', () => {
    expect(relativeDueLabel(-3)).toBe('3 days overdue');
    expect(relativeDueLabel(-1)).toBe('1 day overdue');
    expect(relativeDueLabel(0)).toBe('Due today');
    expect(relativeDueLabel(1)).toBe('Due tomorrow');
    expect(relativeDueLabel(9)).toBe('Due in 9 days');
  });
});

describe('upcoming deadlines', () => {
  const tasks = [
    task({ id: 'next-week', due_date: '2026-12-03' }),
    task({ id: 'overdue', due_date: '2026-11-20' }),
    task({ id: 'today', due_date: '2026-11-25', assignee_ids: ['me'] }),
    task({ id: 'done', due_date: '2026-11-26', status: 'done' }),
    task({ id: 'undated' }),
    task({ id: 'later', due_date: '2027-01-15' }),
  ];

  it('lists open dated tasks, overdue first', () => {
    expect(upcomingDeadlines(tasks, { today: TODAY }).map((d) => d.task.id)).toEqual([
      'overdue',
      'today',
      'next-week',
      'later',
    ]);
  });

  it('can be limited to one member', () => {
    expect(upcomingDeadlines(tasks, { today: TODAY, assigneeId: 'me' }).map((d) => d.task.id)).toEqual(['today']);
  });

  it('counts overdue, this week and next week', () => {
    expect(deadlineSummary(upcomingDeadlines(tasks, { today: TODAY }))).toEqual({
      overdue: 1,
      thisWeek: 1,
      nextWeek: 1,
    });
  });
});
