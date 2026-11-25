/**
 * Pure layout for the projects timeline (the Gantt view at /timeline).
 *
 * Every date here is a calendar day, counted in whole days since 1970-01-01
 * ("day numbers"). Tasks store `start_date` and `due_date` as Postgres `date`
 * strings, which have no time or zone, so converting through UTC keeps a task
 * on the same day for every viewer and through daylight-saving changes.
 */
import type { Priority, ProjectStatus, TaskStatus } from '@/lib/types';

export type TimelineZoom = 'weeks' | 'months' | 'quarters';

/** Width of one day in pixels at each zoom level. */
export const ZOOM_DAY_WIDTH: Record<TimelineZoom, number> = {
  weeks: 36,
  months: 14,
  quarters: 5,
};

export const TIMELINE_ZOOMS: { value: TimelineZoom; label: string }[] = [
  { value: 'weeks', label: 'Weeks' },
  { value: 'months', label: 'Months' },
  { value: 'quarters', label: 'Quarters' },
];

const MS_PER_DAY = 86_400_000;

/** Day number of a `YYYY-MM-DD` value (an ISO timestamp uses its first ten characters). */
export function dayNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const ms = Date.UTC(y, m - 1, d);
  return Number.isNaN(ms) ? null : Math.round(ms / MS_PER_DAY);
}

/** Day number of the viewer's local calendar date. */
export function localDayNumber(date: Date): number {
  return Math.round(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY);
}

/** A Date at UTC midnight of the day; format it with `timeZone: 'UTC'`. */
export function dayToDate(day: number): Date {
  return new Date(day * MS_PER_DAY);
}

export function dayToValue(day: number): string {
  return dayToDate(day).toISOString().slice(0, 10);
}

/** 0 = Monday … 6 = Sunday. 1970-01-01 was a Thursday. */
export function weekdayIndex(day: number): number {
  return (((day + 3) % 7) + 7) % 7;
}

export function isWeekend(day: number): boolean {
  return weekdayIndex(day) >= 5;
}

export type TimelineTaskInput = {
  id: string;
  project_id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assignee_ids: string[];
  /** Absent until migration 0031 adds the column. */
  start_date?: string | null;
  due_date: string | null;
  sort_order: number;
  created_at: string;
};

export type TimelineProjectInput = {
  id: string;
  name: string;
  status: ProjectStatus;
  sort_order: number;
};

/**
 * - `range`: a start and a due date, drawn as a bar.
 * - `milestone`: only a due date, drawn as a diamond on that day.
 * - `start`: only a start date, drawn as a one-day bar.
 */
export type TimelineItemKind = 'range' | 'milestone' | 'start';

export type TimelineItem = {
  id: string;
  projectId: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  assigneeIds: string[];
  kind: TimelineItemKind;
  /** First and last day covered, inclusive. */
  start: number;
  end: number;
  /** Past its due date and not done. */
  overdue: boolean;
};

export type TimelineGroup = {
  project: TimelineProjectInput;
  /** From the earliest scheduled task to the latest; null when none is scheduled. */
  span: { start: number; end: number } | null;
  items: TimelineItem[];
  /** Tasks with neither a start nor a due date. */
  unscheduled: number;
};

export type TimelineModel = {
  groups: TimelineGroup[];
  /** Inclusive day range shown, from a Monday to a Sunday. */
  range: { start: number; end: number };
  today: number;
  unscheduled: number;
};

export type TimelineOptions = {
  today: number;
  /** Leave out tasks whose status is done. */
  hideDone?: boolean;
  /** Only tasks assigned to this member. */
  assigneeId?: string | null;
};

/** How far the view reaches before and after today when nothing is scheduled. */
const DEFAULT_BEFORE = 14;
const DEFAULT_AFTER = 70;
/** Dates further than this from today don't stretch the view. */
const MAX_REACH = 400;
const EDGE_PADDING = 7;

export function timelineItem(task: TimelineTaskInput, today: number): TimelineItem | null {
  const start = dayNumber(task.start_date ?? null);
  const due = dayNumber(task.due_date);
  if (start === null && due === null) return null;

  const base = {
    id: task.id,
    projectId: task.project_id,
    title: task.title,
    status: task.status,
    priority: task.priority,
    assigneeIds: task.assignee_ids ?? [],
    overdue: due !== null && due < today && task.status !== 'done',
  };
  if (start !== null && due !== null) {
    // A start after the due date is a typo; show the days it covers either way.
    return { ...base, kind: 'range', start: Math.min(start, due), end: Math.max(start, due) };
  }
  if (due !== null) return { ...base, kind: 'milestone', start: due, end: due };
  return { ...base, kind: 'start', start: start!, end: start! };
}

function compareItems(a: TimelineItem, b: TimelineItem): number {
  return a.start - b.start || a.end - b.end || a.title.localeCompare(b.title);
}

export function buildTimeline(
  tasks: TimelineTaskInput[],
  projects: TimelineProjectInput[],
  { today, hideDone = false, assigneeId = null }: TimelineOptions
): TimelineModel {
  const visible = tasks.filter(
    (task) =>
      (!hideDone || task.status !== 'done') &&
      (!assigneeId || (task.assignee_ids ?? []).includes(assigneeId))
  );

  const byProject = new Map<string, TimelineTaskInput[]>();
  for (const task of visible) {
    const list = byProject.get(task.project_id) ?? [];
    list.push(task);
    byProject.set(task.project_id, list);
  }

  let earliest = today - DEFAULT_BEFORE;
  let latest = today + DEFAULT_AFTER;
  let unscheduledTotal = 0;
  const groups: TimelineGroup[] = [];

  const orderedProjects = [...projects].sort(
    (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
  );
  for (const project of orderedProjects) {
    const projectTasks = byProject.get(project.id) ?? [];
    if (projectTasks.length === 0) continue;
    const items: TimelineItem[] = [];
    let unscheduled = 0;
    for (const task of projectTasks) {
      const item = timelineItem(task, today);
      if (item) items.push(item);
      else unscheduled += 1;
    }
    items.sort(compareItems);
    unscheduledTotal += unscheduled;

    let span: TimelineGroup['span'] = null;
    for (const item of items) {
      span = span
        ? { start: Math.min(span.start, item.start), end: Math.max(span.end, item.end) }
        : { start: item.start, end: item.end };
      earliest = Math.min(earliest, Math.max(item.start - EDGE_PADDING, today - MAX_REACH));
      latest = Math.max(latest, Math.min(item.end + EDGE_PADDING, today + MAX_REACH));
    }
    groups.push({ project, span, items, unscheduled });
  }

  // Whole weeks, Monday to Sunday, so week lines and labels line up.
  const start = earliest - weekdayIndex(earliest);
  const end = latest + (6 - weekdayIndex(latest));
  return { groups, range: { start, end }, today, unscheduled: unscheduledTotal };
}

/** Pixel offset of the left edge of a day. */
export function dayOffset(day: number, range: { start: number }, dayWidth: number): number {
  return (day - range.start) * dayWidth;
}

export type TimelineBand = { start: number; end: number; label: string };
export type TimelineTick = { day: number; label: string; weekend: boolean };

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Consecutive runs of days that share a key, clipped to the range. */
function bands(
  range: { start: number; end: number },
  keyOf: (date: Date) => string,
  labelOf: (date: Date) => string
): TimelineBand[] {
  const out: (TimelineBand & { key: string })[] = [];
  for (let day = range.start; day <= range.end; day += 1) {
    const date = dayToDate(day);
    const key = keyOf(date);
    const last = out[out.length - 1];
    if (last && last.key === key) last.end = day;
    else out.push({ start: day, end: day, label: labelOf(date), key });
  }
  return out.map(({ start, end, label }) => ({ start, end, label }));
}

/**
 * Header rows for a zoom level: `top` is the coarse band (months or years) and
 * `ticks` label the finer unit (days, week starts or months).
 */
export function timelineHeader(
  range: { start: number; end: number },
  zoom: TimelineZoom
): { top: TimelineBand[]; ticks: TimelineTick[] } {
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
  if (zoom === 'quarters') {
    const top = bands(range, (d) => String(d.getUTCFullYear()), (d) => String(d.getUTCFullYear()));
    const ticks = bands(range, monthKey, (d) => MONTH_SHORT[d.getUTCMonth()]).map((band) => ({
      day: band.start,
      label: band.label,
      weekend: false,
    }));
    return { top, ticks };
  }
  const top = bands(range, monthKey, (d) => `${MONTH_LONG[d.getUTCMonth()]} ${d.getUTCFullYear()}`);
  const ticks: TimelineTick[] = [];
  for (let day = range.start; day <= range.end; day += 1) {
    if (zoom === 'months' && weekdayIndex(day) !== 0) continue;
    ticks.push({ day, label: String(dayToDate(day).getUTCDate()), weekend: isWeekend(day) });
  }
  return { top, ticks };
}

/** "Nov 3", or "Nov 3, 2027" outside the current year. */
export function shortDayLabel(day: number, today: number): string {
  const date = dayToDate(day);
  const label = `${MONTH_SHORT[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return date.getUTCFullYear() === dayToDate(today).getUTCFullYear()
    ? label
    : `${label}, ${date.getUTCFullYear()}`;
}

/** The dates an item covers, for its row: "Nov 3 – Nov 14", "Due Nov 14", "Starts Nov 3". */
export function itemDateLabel(item: Pick<TimelineItem, 'kind' | 'start' | 'end'>, today: number): string {
  if (item.kind === 'milestone') return `Due ${shortDayLabel(item.end, today)}`;
  if (item.kind === 'start') return `Starts ${shortDayLabel(item.start, today)}`;
  if (item.start === item.end) return shortDayLabel(item.start, today);
  return `${shortDayLabel(item.start, today)} – ${shortDayLabel(item.end, today)}`;
}

// ---- Coming up ----------------------------------------------------------------

export type Deadline<T> = { task: T; due: number; daysLeft: number };

/** Open tasks with a due date, overdue first, then soonest. */
export function upcomingDeadlines<T extends TimelineTaskInput>(
  tasks: T[],
  { today, assigneeId = null }: { today: number; assigneeId?: string | null }
): Deadline<T>[] {
  const out: Deadline<T>[] = [];
  for (const task of tasks) {
    if (task.status === 'done') continue;
    if (assigneeId && !(task.assignee_ids ?? []).includes(assigneeId)) continue;
    const due = dayNumber(task.due_date);
    if (due === null) continue;
    out.push({ task, due, daysLeft: due - today });
  }
  return out.sort((a, b) => a.due - b.due || a.task.title.localeCompare(b.task.title));
}

export function deadlineSummary(deadlines: { daysLeft: number }[]): {
  overdue: number;
  thisWeek: number;
  nextWeek: number;
} {
  let overdue = 0;
  let thisWeek = 0;
  let nextWeek = 0;
  for (const { daysLeft } of deadlines) {
    if (daysLeft < 0) overdue += 1;
    else if (daysLeft < 7) thisWeek += 1;
    else if (daysLeft < 14) nextWeek += 1;
  }
  return { overdue, thisWeek, nextWeek };
}

export function relativeDueLabel(daysLeft: number): string {
  if (daysLeft < -1) return `${-daysLeft} days overdue`;
  if (daysLeft === -1) return '1 day overdue';
  if (daysLeft === 0) return 'Due today';
  if (daysLeft === 1) return 'Due tomorrow';
  return `Due in ${daysLeft} days`;
}
