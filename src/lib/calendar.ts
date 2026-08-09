export const WEEKS_SHOWN = 6;
export const DAYS_PER_WEEK = 7;

/**
 * The month grid as six rows of seven days, Sunday-first, including the
 * leading/trailing days that pad the first and last weeks.
 *
 * Returned as ROWS rather than a flat list so the picker can lay each week out
 * as its own flex-row of `flex-1` cells. The flat version wrapped a percentage
 * width (`w-[14.2857%]`) and broke on device: 7 x 38.857px fits 272px only in
 * exact arithmetic, and once each cell rounds up to 39px the row needs 273px,
 * so the seventh day wrapped and every date shifted a column left.
 */
export function calendarWeeks(month: Date): Date[][] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());

  return Array.from({ length: WEEKS_SHOWN }, (_, week) =>
    Array.from({ length: DAYS_PER_WEEK }, (_, day) => {
      const date = new Date(start);
      date.setDate(start.getDate() + week * DAYS_PER_WEEK + day);
      return date;
    })
  );
}
