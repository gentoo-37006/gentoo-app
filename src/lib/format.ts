/** Compact relative time, e.g. "just now", "5m ago", "3h ago", "2d ago". */
export function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((Date.now() - then) / 1000);
  if (sec < 45) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

/**
 * Win-loss-tie record, e.g. "8-2-0". Null when nothing has been synced yet —
 * a team with no results is different from one that is 0-0-0.
 */
export function teamRecord(
  wins: number | null | undefined,
  losses: number | null | undefined,
  ties: number | null | undefined
): string | null {
  if (wins == null && losses == null && ties == null) return null;
  return `${wins ?? 0}-${losses ?? 0}-${ties ?? 0}`;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse an ISO value, reading date-only strings (a task's `due_date`) as a
 * LOCAL date. `new Date('2026-08-14')` is UTC midnight, which formats as the
 * 13th anywhere west of Greenwich — a due date must stay on the day it was
 * picked, whatever the timezone.
 */
function parseIso(value: string): Date {
  if (DATE_ONLY.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

/** Localized short date, e.g. "Jun 22". */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/**
 * Whether a date-only due date has passed. A task due *today* is not overdue,
 * so the comparison is against local midnight rather than the current instant.
 */
export function isPastDue(
  due: string | null | undefined,
  now: number | Date = Date.now()
): boolean {
  if (!due) return false;
  const dueDate = parseIso(due);
  if (Number.isNaN(dueDate.getTime())) return false;
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  return dueDate.getTime() < startOfToday.getTime();
}

/** Localized time, e.g. "2:30 PM". */
export function formatTime(iso: string): string {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Weekday + date, e.g. "Mon, Jun 22". */
export function formatDayLabel(iso: string): string {
  const d = parseIso(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}
