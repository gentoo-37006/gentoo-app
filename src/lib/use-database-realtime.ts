import * as React from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

const REALTIME_QUERY_ROOTS = {
  profiles: ['profiles', 'pit_shifts', 'talkie_requests', 'match', 'scouted_team'],
  notifications: ['notifications'],
  scouted_teams: ['team_scores', 'scouted_team', 'picklist'],
  capability_questions: [
    'capability_questions',
    'team_scores',
    'picklist',
  ],
  pit_scouting_entries: ['team_scores', 'scouted_team', 'picklist'],
  pit_scouting_answers: ['team_scores', 'scouted_team', 'picklist'],
  matches: ['matches', 'match', 'my_assignments'],
  scouting_assignments: ['matches', 'match', 'my_assignments'],
  match_reports: ['match', 'team_match_reports'],
  talkie_requests: ['talkie_requests'],
  projects: ['projects', 'project', 'tasks', 'my_open_tasks', 'my_tasks'],
  tasks: ['projects', 'project', 'tasks', 'my_open_tasks', 'my_tasks'],
  pit_shifts: ['pit_shifts'],
  app_settings: [
    'app_settings',
    'matches',
    'match',
    'my_assignments',
    'team_scores',
    'picklist',
    'ftcscout_team_stats',
  ],
} satisfies Record<string, string[]>;

type RealtimeTable = keyof typeof REALTIME_QUERY_ROOTS;

const REALTIME_TABLES = Object.keys(REALTIME_QUERY_ROOTS) as RealtimeTable[];
const INVALIDATION_DELAY_MS = 100;

/**
 * Keeps every Supabase-backed React Query cache current from one app-level
 * channel. Events are batched so bulk imports and reorder mutations refetch
 * each affected query family only once after the database settles.
 */
export function useDatabaseRealtime() {
  const queryClient = useQueryClient();
  const { session, isDemo, refreshProfile } = useAuth();
  const userId = session?.user?.id;

  React.useEffect(() => {
    if (!userId || isDemo) return;

    const pendingRootEvents = new Map<string, number>();
    let invalidationTimer: ReturnType<typeof setTimeout> | null = null;

    const flushInvalidations = () => {
      invalidationTimer = null;
      const rootEvents = new Map(pendingRootEvents);
      pendingRootEvents.clear();
      void queryClient.invalidateQueries({
        predicate: (query) => {
          const root = query.queryKey[0];
          if (typeof root !== 'string') return false;
          const eventTime = rootEvents.get(root);
          return eventTime !== undefined && query.state.dataUpdatedAt < eventTime;
        },
        refetchType: 'active',
      });
    };

    const queueInvalidations = (table: RealtimeTable) => {
      const eventTime = Date.now();
      for (const root of REALTIME_QUERY_ROOTS[table]) {
        pendingRootEvents.set(root, eventTime);
      }
      if (invalidationTimer) clearTimeout(invalidationTimer);
      invalidationTimer = setTimeout(flushInvalidations, INVALIDATION_DELAY_MS);
    };
    const queueAllInvalidations = () => {
      for (const table of REALTIME_TABLES) queueInvalidations(table);
    };

    const browserChannel =
      Platform.OS === 'web' && typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel(`database-sync:${userId}`)
        : null;
    browserChannel?.addEventListener('message', queueAllInvalidations);

    const unsubscribeMutationCache =
      Platform.OS === 'web'
        ? queryClient.getMutationCache().subscribe((event) => {
            if (event.type !== 'updated' || event.action.type !== 'success') return;
            browserChannel?.postMessage('mutation-complete');
          })
        : null;

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let hasSubscribed = false;

    const removeChannel = () => {
      if (!channel) return;
      const currentChannel = channel;
      channel = null;
      void supabase.removeChannel(currentChannel);
    };

    const subscribe = () => {
      const nativeAppIsBackgrounded =
        Platform.OS !== 'web' &&
        (AppState.currentState === 'background' || AppState.currentState === 'inactive');
      if (channel || nativeAppIsBackgrounded) {
        return;
      }

      let nextChannel = supabase.channel(`database-sync:${userId}`);
      for (const table of REALTIME_TABLES) {
        const config =
          table === 'notifications'
            ? {
                event: '*' as const,
                schema: 'public',
                table,
                filter: `user_id=eq.${userId}`,
              }
            : { event: '*' as const, schema: 'public', table };
        nextChannel = nextChannel.on(
          'postgres_changes',
          config,
          (payload) => {
            queueInvalidations(table);

            if (table === 'profiles') {
              const oldId = (payload.old as { id?: string } | null)?.id;
              const newId = (payload.new as { id?: string } | null)?.id;
              if (oldId === userId || newId === userId) void refreshProfile();
            }
          }
        );
      }
      channel = nextChannel;
      nextChannel.subscribe((status) => {
        if (status !== 'SUBSCRIBED') return;
        if (hasSubscribed) queueAllInvalidations();
        hasSubscribed = true;
      });
    };

    subscribe();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        queueAllInvalidations();
        void refreshProfile();
        subscribe();
      } else if (Platform.OS !== 'web') {
        if (invalidationTimer) clearTimeout(invalidationTimer);
        invalidationTimer = null;
        pendingRootEvents.clear();
        removeChannel();
      }
    });

    return () => {
      if (invalidationTimer) clearTimeout(invalidationTimer);
      appStateSubscription.remove();
      unsubscribeMutationCache?.();
      browserChannel?.close();
      removeChannel();
    };
  }, [isDemo, queryClient, refreshProfile, userId]);
}
