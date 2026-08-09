import type { QueryClient, QueryKey } from '@tanstack/react-query';

/**
 * Cancel / snapshot / rollback plumbing shared by every optimistic mutation.
 *
 * The `patch` callback receives whatever is cached under each matched key and
 * returns the replacement — see lib/optimistic-patch.ts for the pure shape
 * edits. Keys are matched by PREFIX, the same way the wrappers invalidate, so
 * one entry covers every `['project', <id>]` currently in the cache.
 */

export type Snapshot = { key: QueryKey; data: unknown }[];

/**
 * Cancelling first matters: an in-flight GET that resolves after we write would
 * overwrite the optimistic value with pre-mutation server data, and the row
 * would visibly flip back before settling.
 */
export async function applyOptimistic(
  qc: QueryClient,
  keys: readonly QueryKey[],
  patch: (data: any, key: QueryKey) => any
): Promise<Snapshot> {
  const snapshot: Snapshot = [];
  for (const key of keys) {
    await qc.cancelQueries({ queryKey: key });
    for (const [matchedKey, data] of qc.getQueriesData({ queryKey: key })) {
      if (data === undefined) continue;
      const next = patch(data, matchedKey);
      if (next === data) continue; // nothing to undo
      snapshot.push({ key: matchedKey, data });
      qc.setQueryData(matchedKey, next);
    }
  }
  return snapshot;
}

/** Restore every key touched by applyOptimistic, newest write first. */
export function rollback(qc: QueryClient, snapshot: Snapshot | undefined): void {
  if (!snapshot) return;
  for (let i = snapshot.length - 1; i >= 0; i -= 1) {
    qc.setQueryData(snapshot[i].key, snapshot[i].data);
  }
}
