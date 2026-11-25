import { eventSeason } from '@/lib/ftcscout-event';
import { useFTCScoutEvent } from '@/lib/queries/ftcscout';
import { ACTIVE_EVENT_KEY, useAppSetting } from '@/lib/queries/settings';
import { useNow } from '@/lib/use-now';

/** The event synced in Settings, with FTC Scout's details for it. */
export function useActiveEvent() {
  const setting = useAppSetting(ACTIVE_EVENT_KEY);
  const value = setting.data?.value;
  const code = typeof value?.eventCode === 'string' ? value.eventCode.trim() : '';
  const now = useNow();
  const season = eventSeason(value, new Date(now));
  const event = useFTCScoutEvent(code, season);
  const lastSynced = typeof value?.last_synced === 'string' ? value.last_synced : null;
  return { setting, code, season, event, lastSynced };
}
