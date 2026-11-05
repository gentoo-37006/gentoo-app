import { currentSeason } from '@/lib/api/ftcscout';
import { formatDate } from '@/lib/format';

/** Older active-event settings only saved the time of their last sync. */
export function eventSeason(
  setting: { season?: unknown; last_synced?: unknown } | null | undefined,
  now: Date,
): number {
  if (typeof setting?.season === 'number' && Number.isInteger(setting.season) && setting.season > 0) {
    return setting.season;
  }
  const synced = typeof setting?.last_synced === 'string' ? new Date(setting.last_synced) : null;
  return currentSeason(synced && !Number.isNaN(synced.getTime()) ? synced : now);
}

export function ftcScoutEventUrl(season: number, eventCode: string): string {
  return `https://ftcscout.org/events/${season}/${encodeURIComponent(eventCode)}`;
}

export function eventDateRange(start: string | null, end: string | null): string {
  const first = formatDate(start);
  const last = formatDate(end);
  return first && last && start !== end ? `${first} – ${last}` : first || last;
}
