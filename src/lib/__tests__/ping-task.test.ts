import { beforeEach, describe, expect, it, vi } from 'vitest';

// notify.ts pulls in the Supabase client, which needs env this suite doesn't
// have; the contract under test is "which rows would we insert", so stub it.
// vi.hoisted, because vi.mock is lifted above every const — referencing a
// plain const from the factory would throw at import time.
const { notifyUsers } = vi.hoisted(() => ({
  notifyUsers: vi.fn<(ids: string[], payload: unknown) => Promise<boolean>>(),
}));
vi.mock('@/lib/notify', () => ({ notifyUsers }));

const {
  PING_COOLDOWN_MS,
  PING_TITLE,
  pingAssignees,
  pingCooldownRemaining,
  resetPingCooldowns,
} = await import('@/lib/ping-task');

const TASK = { taskId: 't1', projectId: 'p1', taskTitle: 'Wire the intake' };
const ME = 'me';
const THEM = 'them';

beforeEach(() => {
  resetPingCooldowns();
  notifyUsers.mockReset();
  notifyUsers.mockResolvedValue(true);
});

describe('pingAssignees', () => {
  it('writes one task notification for each other assignee', async () => {
    const result = await pingAssignees({
      ...TASK,
      projectName: 'Pit readiness',
      assigneeIds: [THEM, 'them2'],
      actorId: ME,
    });

    expect(result).toEqual({ ok: true, pinged: 2 });
    const [ids, payload] = notifyUsers.mock.calls[0];
    expect(ids).toEqual([THEM, 'them2']);
    // `task` is the one type always in the bot's PING_TYPES, so this is what
    // ping_loop will actually deliver to Discord.
    expect(payload).toMatchObject({
      type: 'task',
      title: PING_TITLE,
      body: 'Wire the intake · Pit readiness',
      data: { projectId: 'p1', taskId: 't1' },
    });
  });

  it('never pings the presser', async () => {
    const result = await pingAssignees({ ...TASK, assigneeIds: [ME, THEM], actorId: ME });

    expect(result).toEqual({ ok: true, pinged: 1 });
    expect(notifyUsers.mock.calls[0][0]).toEqual([THEM]);
  });

  it('does nothing when the only assignee is the presser', async () => {
    const result = await pingAssignees({ ...TASK, assigneeIds: [ME], actorId: ME });

    expect(result).toEqual({ ok: false, reason: 'no-recipients' });
    expect(notifyUsers).not.toHaveBeenCalled();
  });

  it('deduplicates a doubly-listed assignee', async () => {
    await pingAssignees({ ...TASK, assigneeIds: [THEM, THEM], actorId: ME });

    expect(notifyUsers.mock.calls[0][0]).toEqual([THEM]);
  });

  it('refuses a second ping inside the cooldown', async () => {
    const now = 1_000_000;
    await pingAssignees({ ...TASK, assigneeIds: [THEM], actorId: ME, now });
    const again = await pingAssignees({
      ...TASK,
      assigneeIds: [THEM],
      actorId: ME,
      now: now + 60_000,
    });

    expect(again).toEqual({
      ok: false,
      reason: 'cooldown',
      retryInMs: PING_COOLDOWN_MS - 60_000,
    });
    expect(notifyUsers).toHaveBeenCalledTimes(1);
  });

  it('allows the next ping once the cooldown lapses', async () => {
    const now = 1_000_000;
    await pingAssignees({ ...TASK, assigneeIds: [THEM], actorId: ME, now });
    const later = await pingAssignees({
      ...TASK,
      assigneeIds: [THEM],
      actorId: ME,
      now: now + PING_COOLDOWN_MS,
    });

    expect(later).toEqual({ ok: true, pinged: 1 });
    expect(notifyUsers).toHaveBeenCalledTimes(2);
  });

  it('cools down per task, not globally', async () => {
    const now = 1_000_000;
    await pingAssignees({ ...TASK, assigneeIds: [THEM], actorId: ME, now });
    const other = await pingAssignees({
      taskId: 't2',
      projectId: 'p1',
      taskTitle: 'Other task',
      assigneeIds: [THEM],
      actorId: ME,
      now,
    });

    expect(other).toEqual({ ok: true, pinged: 1 });
  });

  it('does NOT start the cooldown when the insert failed', async () => {
    // Otherwise one transient error locks the button for ten minutes having
    // pinged nobody at all.
    notifyUsers.mockResolvedValue(false);
    const now = 1_000_000;

    const failed = await pingAssignees({ ...TASK, assigneeIds: [THEM], actorId: ME, now });

    expect(failed).toEqual({ ok: false, reason: 'failed' });
    expect(pingCooldownRemaining('t1', now)).toBe(0);

    notifyUsers.mockResolvedValue(true);
    const retry = await pingAssignees({ ...TASK, assigneeIds: [THEM], actorId: ME, now });
    expect(retry).toEqual({ ok: true, pinged: 1 });
  });

  it('omits the project suffix when the name is unknown', async () => {
    await pingAssignees({ ...TASK, projectName: null, assigneeIds: [THEM], actorId: ME });

    expect(notifyUsers.mock.calls[0][1]).toMatchObject({ body: 'Wire the intake' });
  });
});
