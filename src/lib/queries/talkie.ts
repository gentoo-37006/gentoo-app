import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import {
  demoCreateTalkie,
  demoCurrentUserId,
  demoDeleteTalkie,
  demoPatchTalkie,
  demoTalkieRequests,
  isDemoMode,
} from '@/lib/demo';
import { notifyUsers } from '@/lib/notify';
import type { TalkieRequest } from '@/lib/types';

export const talkieKey = ['talkie_requests'] as const;

async function currentUserId(): Promise<string | undefined> {
  if (isDemoMode()) return demoCurrentUserId();
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id;
}

export type TalkieWithPeople = TalkieRequest & {
  requester: { full_name: string | null; avatar_url: string | null } | null;
  claimer: { full_name: string | null; avatar_url: string | null } | null;
};

export function useTalkieRequests() {
  return useQuery({
    queryKey: talkieKey,
    queryFn: async (): Promise<TalkieWithPeople[]> => {
      if (isDemoMode()) return demoTalkieRequests();
      const { data, error } = await supabase
        .from('talkie_requests')
        .select(
          '*, requester:requester_id(full_name, avatar_url), claimer:claimed_by(full_name, avatar_url)'
        )
        .order('status', { ascending: true })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TalkieWithPeople[];
    },
  });
}

export function useTalkieRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    if (isDemoMode()) return;
    const channel = supabase
      .channel('talkie_requests')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'talkie_requests' }, () =>
        qc.invalidateQueries({ queryKey: talkieKey })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}

function useTalkieMutation<TVars>(fn: (vars: TVars) => Promise<void>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: talkieKey }),
  });
}

export function useCreateTalkie() {
  return useTalkieMutation<{ teamNumber: number; reason: string }>(async ({ teamNumber, reason }) => {
    if (isDemoMode()) return demoCreateTalkie(teamNumber, reason);
    const uid = await currentUserId();
    const { error } = await supabase
      .from('talkie_requests')
      .insert({ requester_id: uid, team_number: teamNumber, reason });
    if (error) throw error;

    // Ping pit / scouter members; fall back to everyone if no one holds a role.
    const { data: roled } = await supabase
      .from('profiles')
      .select('id')
      .eq('status', 'approved')
      .overlaps('functional_roles', ['pit', 'scouter']);
    let recipients = (roled ?? []).map((p: { id: string }) => p.id);
    if (recipients.length === 0) {
      const { data: all } = await supabase.from('profiles').select('id').eq('status', 'approved');
      recipients = (all ?? []).map((p: { id: string }) => p.id);
    }
    await notifyUsers(
      recipients.filter((id) => id !== uid),
      {
        type: 'talkie_request',
        title: `Talkie: team ${teamNumber}`,
        body: reason,
        data: { teamNumber },
      }
    );
  });
}

export function useClaimTalkie() {
  return useTalkieMutation<{ id: string; requesterId: string | null; teamNumber: number }>(
    async ({ id, requesterId, teamNumber }) => {
      if (isDemoMode()) {
        const uid = await demoCurrentUserId();
        return demoPatchTalkie(id, { status: 'claimed', claimed_by: uid, claimed_at: new Date().toISOString() });
      }
      const uid = await currentUserId();
      const { error } = await supabase
        .from('talkie_requests')
        .update({ status: 'claimed', claimed_by: uid, claimed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      if (requesterId && requesterId !== uid) {
        await notifyUsers([requesterId], {
          type: 'talkie_claimed',
          title: `Talkie claimed: team ${teamNumber}`,
          body: 'Someone is heading over to ask.',
          data: { teamNumber },
        });
      }
    }
  );
}

export function useResolveTalkie() {
  return useTalkieMutation<{
    id: string;
    response: string;
    requesterId: string | null;
    teamNumber: number;
  }>(async ({ id, response, requesterId, teamNumber }) => {
    if (isDemoMode()) return demoPatchTalkie(id, { status: 'resolved', response, resolved_at: new Date().toISOString() });
    const uid = await currentUserId();
    const { error } = await supabase
      .from('talkie_requests')
      .update({ status: 'resolved', response, resolved_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    if (requesterId && requesterId !== uid) {
      await notifyUsers([requesterId], {
        type: 'talkie_resolved',
        title: `Talkie resolved: team ${teamNumber}`,
        body: response,
        data: { teamNumber },
      });
    }
  });
}

export function useDeleteTalkie() {
  return useTalkieMutation<string>(async (id) => {
    if (isDemoMode()) return demoDeleteTalkie(id);
    const { error } = await supabase.from('talkie_requests').delete().eq('id', id);
    if (error) throw error;
  });
}
