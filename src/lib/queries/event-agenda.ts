import { agendaForEvent, type AgendaItem } from '@/lib/competition';
import { useAppSetting, useSetAppSetting } from '@/lib/queries/settings';

/**
 * The team's event-day plan (arrival, inspection, judging interview, ceremonies)
 * lives in app_settings under this key as `{ eventCode, items }`. Tying it to
 * the event code means syncing a new event starts with an empty agenda rather
 * than last event's times. app_settings is on the realtime channel, so every
 * phone sees an edit straight away.
 */
export const EVENT_AGENDA_KEY = 'event_agenda';

export function useEventAgenda(eventCode: string) {
  const setting = useAppSetting(EVENT_AGENDA_KEY, { enabled: !!eventCode });
  return {
    items: agendaForEvent(setting.data?.value, eventCode),
    isPending: !!eventCode && setting.isPending,
    isError: setting.isError,
    refetch: setting.refetch,
  };
}

export function useSaveEventAgenda() {
  const setSetting = useSetAppSetting();
  return {
    isPending: setSetting.isPending,
    save: (eventCode: string, items: AgendaItem[]) =>
      setSetting.mutateAsync({ key: EVENT_AGENDA_KEY, value: { eventCode, items } }),
  };
}
