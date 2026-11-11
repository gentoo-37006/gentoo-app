type EventDates = { start: string | null; end: string | null };

function calendarDay(value: string | null): string | null {
  const day = value?.match(/^\d{4}-\d{2}-\d{2}(?=$|T)/)?.[0];
  if (!day) return null;
  const parsed = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day
    ? day
    : null;
}

/** Event dates are calendar days, not midnight UTC instants. */
export function homeRoute(event: EventDates | null | undefined, now: Date): '/competition' | '/dashboard' {
  const start = calendarDay(event?.start ?? null);
  const end = event?.end == null ? start : calendarDay(event.end);
  if (!start || !end || end < start || Number.isNaN(now.getTime())) return '/dashboard';
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return today >= start && today <= end ? '/competition' : '/dashboard';
}
