/**
 * Where a newly created task lands in its project's manual order.
 *
 * Tasks are listed `sort_order ASC`, so "top of the list" means a value BELOW
 * every existing one — new tasks used to take `max + 10` and appear at the
 * bottom, where nobody saw them. Manual drag-reordering still wins afterwards:
 * a reorder rewrites every row to `(index + 1) * 10`, which normalises the
 * negatives away.
 */
export const SORT_STEP = 10;

export function nextTaskSortOrder(
  existing: readonly { sort_order?: number | null }[]
): number {
  const orders = existing.map((item) => item.sort_order ?? 0);
  // Math.min() of nothing is Infinity, so seed with 0 for the first task.
  return Math.min(0, ...orders) - SORT_STEP;
}
