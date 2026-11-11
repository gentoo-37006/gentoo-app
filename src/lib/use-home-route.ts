import { useAuth } from '@/lib/auth';
import { eventSeason } from '@/lib/ftcscout-event';
import { homeRoute } from '@/lib/home-route';
import { useFTCScoutEvent } from '@/lib/queries/ftcscout';
import { ACTIVE_EVENT_KEY, useAppSetting } from '@/lib/queries/settings';
import { useNow } from '@/lib/use-now';

export function useHomeRoute(enabled: boolean) {
  const { isDemo } = useAuth();
  const now = new Date(useNow());
  const setting = useAppSetting(ACTIVE_EVENT_KEY, { enabled: enabled && !isDemo });
  const value = enabled && !isDemo ? setting.data?.value : null;
  const code = typeof value?.eventCode === 'string' ? value.eventCode.trim() : '';
  const event = useFTCScoutEvent(code, eventSeason(value, now));
  return {
    ready: enabled && (isDemo || (!setting.isPending && (!code || !event.isPending))),
    href: homeRoute(code ? event.data : null, now),
  };
}
