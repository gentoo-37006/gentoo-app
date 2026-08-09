import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  demoMarkAllNotificationsRead,
  demoMarkNotificationRead,
  demoClearAllNotifications,
  demoClearNotification,
  demoNotifications,
  isDemoMode,
} from '@/lib/demo';
import { removeById, updateAll, updateById } from '@/lib/optimistic-patch';
import { applyOptimistic, rollback, type Snapshot } from '@/lib/queries/optimistic';
import type { AppNotification } from '@/lib/types';

export function notificationsKey(uid?: string) {
  return ['notifications', uid] as const;
}

export function useNotifications() {
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useQuery({
    queryKey: notificationsKey(uid),
    enabled: !!uid,
    queryFn: async (): Promise<AppNotification[]> => {
      if (isDemoMode()) return demoNotifications(uid);
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as AppNotification[];
    },
  });
}

export function useUnreadCount(): number {
  const { data } = useNotifications();
  return (data ?? []).filter((n) => !n.read).length;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return demoMarkNotificationRead(id);
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) =>
      applyOptimistic(qc, [notificationsKey(uid)], (list: AppNotification[]) =>
        updateById(list, id, { read: true })
      ),
    onError: (_error, _id, snapshot) => rollback(qc, snapshot as Snapshot),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useMutation({
    mutationFn: async () => {
      if (!uid) return;
      if (isDemoMode()) return demoMarkAllNotificationsRead(uid);
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', uid)
        .eq('read', false);
      if (error) throw error;
    },
    onMutate: () =>
      applyOptimistic(qc, [notificationsKey(uid)], (list: AppNotification[]) =>
        updateAll(list, { read: true })
      ),
    onError: (_error, _vars, snapshot) => rollback(qc, snapshot as Snapshot),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}

export function useClearNotification() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useMutation({
    mutationFn: async (id: string) => {
      if (isDemoMode()) return demoClearNotification(id);
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
    },
    onMutate: (id) =>
      applyOptimistic(qc, [notificationsKey(uid)], (list: AppNotification[]) =>
        removeById(list, id)
      ),
    onError: (_error, _id, snapshot) => rollback(qc, snapshot as Snapshot),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}

export function useClearAllNotifications() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useMutation({
    mutationFn: async () => {
      if (!uid) return;
      if (isDemoMode()) return demoClearAllNotifications(uid);
      const { error } = await supabase.from('notifications').delete().eq('user_id', uid);
      if (error) throw error;
    },
    onMutate: () => applyOptimistic(qc, [notificationsKey(uid)], () => []),
    onError: (_error, _vars, snapshot) => rollback(qc, snapshot as Snapshot),
    onSettled: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}
