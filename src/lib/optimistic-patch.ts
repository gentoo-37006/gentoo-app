/**
 * Pure cache-shape edits used by optimistic mutations.
 *
 * Kept free of react-query so the reasoning that is easy to get wrong — "does
 * this row still exist", "did we clone instead of mutating" — is unit tested,
 * while the hook layer only handles cancel/snapshot/rollback.
 *
 * Every helper returns a NEW array/object. Mutating a cached value in place
 * would leave nothing to roll back to when the request fails.
 */

type Identified = { id: string };

/** Replace one row by id. Returns the same reference when nothing matched. */
export function updateById<T extends Identified>(
  list: readonly T[] | undefined,
  id: string,
  patch: Partial<T>
): T[] | undefined {
  if (!list) return list;
  let changed = false;
  const next = list.map((item) => {
    if (item.id !== id) return item;
    changed = true;
    return { ...item, ...patch };
  });
  return changed ? next : (list as T[]);
}

/** Drop one row by id. */
export function removeById<T extends Identified>(
  list: readonly T[] | undefined,
  id: string
): T[] | undefined {
  if (!list) return list;
  const next = list.filter((item) => item.id !== id);
  return next.length === list.length ? (list as T[]) : next;
}

/** Apply `patch` to every row. */
export function updateAll<T>(
  list: readonly T[] | undefined,
  patch: Partial<T>
): T[] | undefined {
  if (!list) return list;
  return list.map((item) => ({ ...item, ...patch }));
}

/**
 * The `useProject` cache is `{ project, tasks }` rather than a bare array, so
 * task edits need to reach one level in without disturbing `project`.
 */
// The task type is derived FROM the cache shape rather than being its own
// parameter: as a standalone generic it has no inference site here and silently
// widens to `Identified`, which then rejects every real field in the patch.
export function updateTaskInProject<TShape extends { tasks: Identified[] }>(
  data: TShape | undefined,
  taskId: string,
  patch: Partial<TShape['tasks'][number]>
): TShape | undefined {
  if (!data) return data;
  const tasks = updateById(data.tasks, taskId, patch);
  return tasks === data.tasks ? data : { ...data, tasks };
}

export function removeTaskFromProject<TShape extends { tasks: Identified[] }>(
  data: TShape | undefined,
  taskId: string
): TShape | undefined {
  if (!data) return data;
  const tasks = removeById(data.tasks, taskId);
  return tasks === data.tasks ? data : { ...data, tasks };
}
