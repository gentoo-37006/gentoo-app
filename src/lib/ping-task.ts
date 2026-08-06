import { notifyUsers } from '@/lib/notify';

/**
 * "Ping" nudges a task's assignees on Discord.
 *
 * There is no bot webhook behind this: inserting a `task` notification row is
 * already the bot's delivery path (loops.py ping_loop polls every ~15s and
 * @-mentions the assignee with Start / Mark-done buttons), and the same insert
 * fires the send-push Edge Function for an OS notification. So a reminder is
 * one row per recipient — no new endpoint, no shared secret, and it inherits
 * the bot's existing per-user opt-out and claim-before-send de-duplication.
 */

export const PING_COOLDOWN_MS = 10 * 60 * 1000;

/** Distinct from the "New task assigned" row so a nudge reads as a nudge. */
export const PING_TITLE = 'Task reminder';

// Cooldown is per-device on purpose. RLS on `notifications` is select-own-only
// (migration 0002), so a client CANNOT read the rows it sent to someone else to
// find out when they were last pinged; a shared cooldown would need a column on
// `tasks` and a migration. This stops the double-tap and the impatient re-press,
// which is what actually happens — it is not a defence against a determined
// spammer, and shouldn't be mistaken for one.
const lastPingedAt = new Map<string, number>();

export type PingResult =
  | { ok: true; pinged: number }
  | { ok: false; reason: 'cooldown'; retryInMs: number }
  | { ok: false; reason: 'no-recipients' }
  | { ok: false; reason: 'failed' };

/** Milliseconds left before this task may be pinged again (0 when ready). */
export function pingCooldownRemaining(taskId: string, now: number = Date.now()): number {
  const last = lastPingedAt.get(taskId);
  if (last === undefined) return 0;
  return Math.max(0, PING_COOLDOWN_MS - (now - last));
}

/** Test seam — the module-level cooldown would otherwise leak between tests. */
export function resetPingCooldowns(): void {
  lastPingedAt.clear();
}

export async function pingAssignees(opts: {
  taskId: string;
  projectId: string;
  taskTitle: string;
  projectName?: string | null;
  assigneeIds: readonly string[];
  /** Current user — never pinged, since pressing Ping IS the acknowledgement. */
  actorId?: string | null;
  now?: number;
}): Promise<PingResult> {
  const now = opts.now ?? Date.now();

  const retryInMs = pingCooldownRemaining(opts.taskId, now);
  if (retryInMs > 0) return { ok: false, reason: 'cooldown', retryInMs };

  const recipients = Array.from(new Set(opts.assigneeIds)).filter(
    (id) => Boolean(id) && id !== opts.actorId
  );
  if (recipients.length === 0) return { ok: false, reason: 'no-recipients' };

  const sent = await notifyUsers(recipients, {
    type: 'task',
    title: PING_TITLE,
    body: opts.projectName
      ? `${opts.taskTitle} · ${opts.projectName}`
      : opts.taskTitle,
    data: { projectId: opts.projectId, taskId: opts.taskId },
  });

  // Only start the cooldown once the rows actually landed, or a transient
  // failure would lock the button for ten minutes having pinged nobody.
  if (!sent) return { ok: false, reason: 'failed' };
  lastPingedAt.set(opts.taskId, now);
  return { ok: true, pinged: recipients.length };
}
