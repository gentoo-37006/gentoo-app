import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
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
      const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  return useMutation({
    mutationFn: async () => {
      if (!uid) return;
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', uid)
        .eq('read', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationsKey(uid) }),
  });
}

/** Subscribe to live notification changes for the signed-in user. */
export function useNotificationsRealtime() {
  const qc = useQueryClient();
  const { session } = useAuth();
  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) return;
    const channel = supabase
      .channel(`notifications:${uid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
        () => qc.invalidateQueries({ queryKey: notificationsKey(uid) })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [uid, qc]);
}
