import { supabase } from '@/lib/supabase';
import type { FunctionalRole, NotificationType } from '@/lib/types';

export type NotifyPayload = {
  type: NotificationType;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
};

/**
 * Create in-app notifications for the given users. Inserting a row also fires
 * the send-push Edge Function (via DB webhook) to deliver a push notification.
 */
export async function notifyUsers(userIds: string[], payload: NotifyPayload): Promise<void> {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  if (ids.length === 0) return;
  const rows = ids.map((user_id) => ({
    user_id,
    type: payload.type,
    title: payload.title,
    body: payload.body ?? null,
    data: payload.data ?? {},
  }));
  const { error } = await supabase.from('notifications').insert(rows);
  if (error) console.warn('[notify] failed to insert notifications:', error.message);
}

async function approvedIdsWhere(build: (q: any) => any): Promise<string[]> {
  const { data, error } = await build(
    supabase.from('profiles').select('id').eq('status', 'approved')
  );
  if (error) {
    console.warn('[notify] failed to resolve recipients:', error.message);
    return [];
  }
  return (data ?? []).map((p: { id: string }) => p.id);
}

/** Notify all approved members holding a functional role (e.g. strategists). */
export async function notifyByFunctionalRole(
  role: FunctionalRole,
  payload: NotifyPayload,
  opts?: { excludeUserId?: string }
): Promise<void> {
  let ids = await approvedIdsWhere((q) => q.contains('functional_roles', [role]));
  if (opts?.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId);
  await notifyUsers(ids, payload);
}

/** Notify approved members holding ANY of the given functional roles (deduped). */
export async function notifyByAnyFunctionalRole(
  roles: FunctionalRole[],
  payload: NotifyPayload,
  opts?: { excludeUserId?: string }
): Promise<void> {
  let ids = await approvedIdsWhere((q) => q.overlaps('functional_roles', roles));
  if (opts?.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId);
  await notifyUsers(ids, payload);
}

/** Notify every approved member. */
export async function notifyAllApproved(
  payload: NotifyPayload,
  opts?: { excludeUserId?: string }
): Promise<void> {
  let ids = await approvedIdsWhere((q) => q);
  if (opts?.excludeUserId) ids = ids.filter((id) => id !== opts.excludeUserId);
  await notifyUsers(ids, payload);
}
