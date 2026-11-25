/**
 * Pure decisions behind the competition screen: which synced matches are ours,
 * how each went, where the event stands, and the event-day schedule.
 *
 * The FTC Scout sync stores every match and team at the event; everything here
 * narrows that down to one team, given as an argument (OUR_TEAM_NUMBER in the
 * app) so it can be tested without module state.
 */
import { dayNumber, localDayNumber } from '@/lib/timeline';

// ---- Matches ------------------------------------------------------------------

export type MatchTeams = {
  red1: number | null;
  red2: number | null;
  blue1: number | null;
  blue2: number | null;
};

export type ScoredMatch = MatchTeams & {
  id: string;
  match_number: number;
  label: string | null;
  scheduled_time: string | null;
  has_been_played?: boolean;
  red_score?: number | null;
  blue_score?: number | null;
};

export type Alliance = 'red' | 'blue';

export function allianceOf(match: MatchTeams, team: number): Alliance | null {
  if (match.red1 === team || match.red2 === team) return 'red';
  if (match.blue1 === team || match.blue2 === team) return 'blue';
  return null;
}

/** Our partners and opponents in a match we play in. */
export function matchSides(
  match: MatchTeams,
  team: number
): { alliance: Alliance; partners: number[]; opponents: number[] } | null {
  const alliance = allianceOf(match, team);
  if (!alliance) return null;
  const red = [match.red1, match.red2].filter((n): n is number => n != null);
  const blue = [match.blue1, match.blue2].filter((n): n is number => n != null);
  const own = alliance === 'red' ? red : blue;
  return {
    alliance,
    partners: own.filter((n) => n !== team),
    opponents: alliance === 'red' ? blue : red,
  };
}

const matchTime = (match: ScoredMatch) =>
  match.scheduled_time ? new Date(match.scheduled_time).getTime() : Number.POSITIVE_INFINITY;

/** The matches we play in, in schedule order. */
export function ourMatches<T extends ScoredMatch>(matches: T[], team: number): T[] {
  return matches
    .filter((match) => allianceOf(match, team) !== null)
    .sort((a, b) => matchTime(a) - matchTime(b) || a.match_number - b.match_number);
}

export type MatchOutcome = 'win' | 'loss' | 'tie';

/** How a played match went for us; null until it has a score. */
export function matchResult(
  match: ScoredMatch,
  team: number
): { outcome: MatchOutcome; ours: number; theirs: number } | null {
  const alliance = allianceOf(match, team);
  if (!alliance || match.red_score == null || match.blue_score == null) return null;
  if (match.has_been_played === false) return null;
  const ours = alliance === 'red' ? match.red_score : match.blue_score;
  const theirs = alliance === 'red' ? match.blue_score : match.red_score;
  return { outcome: ours > theirs ? 'win' : ours < theirs ? 'loss' : 'tie', ours, theirs };
}

export function hasResult(match: ScoredMatch): boolean {
  return match.has_been_played !== false && match.red_score != null && match.blue_score != null;
}

/**
 * Our next match: the first without a result whose start is no more than
 * `graceMs` ago (a match runs a few minutes past its scheduled start).
 */
export function nextMatch<T extends ScoredMatch>(
  matches: T[],
  team: number,
  now: number,
  graceMs = 5 * 60_000
): T | null {
  return (
    ourMatches(matches, team).find(
      (match) => !hasResult(match) && match.scheduled_time != null && matchTime(match) > now - graceMs
    ) ?? null
  );
}

export function ourRecord(matches: ScoredMatch[], team: number): { wins: number; losses: number; ties: number } {
  const record = { wins: 0, losses: 0, ties: 0 };
  for (const match of matches) {
    const result = matchResult(match, team);
    if (!result) continue;
    if (result.outcome === 'win') record.wins += 1;
    else if (result.outcome === 'loss') record.losses += 1;
    else record.ties += 1;
  }
  return record;
}

// ---- Event status ---------------------------------------------------------------

export type EventTiming = {
  start: string | null;
  end: string | null;
  started?: boolean | null;
  ongoing?: boolean | null;
  finished?: boolean | null;
};

export type EventStatus =
  | { kind: 'upcoming'; label: string }
  | { kind: 'live'; label: string }
  | { kind: 'finished'; label: string }
  | { kind: 'unknown'; label: string };

/** Where the event stands on the viewer's calendar: "In 3 days", "Day 1 of 2", "Finished". */
export function eventStatus(event: EventTiming, now: Date): EventStatus {
  const today = localDayNumber(now);
  const start = dayNumber(event.start);
  const end = dayNumber(event.end) ?? start;
  if (start === null || end === null) {
    if (event.finished) return { kind: 'finished', label: 'Finished' };
    if (event.ongoing) return { kind: 'live', label: 'Happening now' };
    return { kind: 'unknown', label: 'Dates not announced' };
  }
  if (today < start) {
    const days = start - today;
    return { kind: 'upcoming', label: days === 1 ? 'Starts tomorrow' : `Starts in ${days} days` };
  }
  if (today > end || (event.finished && today >= end)) return { kind: 'finished', label: 'Finished' };
  const length = end - start + 1;
  return { kind: 'live', label: length > 1 ? `Day ${today - start + 1} of ${length}` : 'Today' };
}

// ---- Awards -----------------------------------------------------------------------

const AWARD_NAMES: Record<string, string> = {
  Inspire: 'Inspire Award',
  Think: 'Think Award',
  Connect: 'Connect Award',
  Innovate: 'Innovate Award',
  Control: 'Control Award',
  Motivate: 'Motivate Award',
  Design: 'Design Award',
  Reach: 'Reach Award',
  Sustain: 'Sustain Award',
  Promote: 'Promote Award',
  Compass: 'Compass Award',
  JudgesChoice: "Judges' Choice Award",
  DeansListWinner: "Dean's List Winner",
  DeansListFinalist: "Dean's List Finalist",
  DeansListSemiFinalist: "Dean's List Semi-Finalist",
  Winner: 'Winning Alliance',
  Finalist: 'Finalist Alliance',
  DivisionWinner: 'Division Winner',
  DivisionFinalist: 'Division Finalist',
  ConferenceFinalist: 'Conference Finalist',
  TopRanked: 'Top Ranked Team',
};

const ORDINALS = ['', '', '2nd place', '3rd place', '4th place', '5th place'];

/** "Think Award", "Inspire Award · 2nd place". */
export function awardName(type: string, placement: number | null | undefined): string {
  const name = AWARD_NAMES[type] ?? type.replace(/([a-z])([A-Z])/g, '$1 $2');
  const alliance = type === 'Winner' || type === 'Finalist';
  const place = !alliance && placement && placement > 1 ? ORDINALS[placement] ?? `${placement}th place` : '';
  return place ? `${name} · ${place}` : name;
}

// ---- Event-day schedule -------------------------------------------------------------

export type AgendaKind =
  | 'arrival'
  | 'inspection'
  | 'judging'
  | 'meeting'
  | 'ceremony'
  | 'selection'
  | 'awards'
  | 'other';

export const AGENDA_KINDS: { value: AgendaKind; label: string }[] = [
  { value: 'arrival', label: 'Arrival' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'judging', label: 'Judging' },
  { value: 'meeting', label: 'Drivers meeting' },
  { value: 'ceremony', label: 'Ceremony' },
  { value: 'selection', label: 'Alliance selection' },
  { value: 'awards', label: 'Awards' },
  { value: 'other', label: 'Other' },
];

/** One entry of the team's event-day plan, entered by an admin. */
export type AgendaItem = {
  id: string;
  kind: AgendaKind;
  title: string;
  /** ISO timestamps. */
  start: string;
  end: string | null;
  location: string | null;
  notes: string | null;
};

const KIND_VALUES = new Set<string>(AGENDA_KINDS.map((k) => k.value));

const isTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(new Date(value).getTime());

const optionalText = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

/** The agenda saved in app_settings, dropping anything malformed instead of failing. */
export function parseAgenda(value: unknown): AgendaItem[] {
  if (!Array.isArray(value)) return [];
  const items: AgendaItem[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    if (typeof r.id !== 'string' || !isTime(r.start)) continue;
    const title = optionalText(r.title);
    if (!title) continue;
    items.push({
      id: r.id,
      kind: typeof r.kind === 'string' && KIND_VALUES.has(r.kind) ? (r.kind as AgendaKind) : 'other',
      title,
      start: new Date(r.start).toISOString(),
      end: isTime(r.end) && new Date(r.end).getTime() > new Date(r.start).getTime() ? new Date(r.end).toISOString() : null,
      location: optionalText(r.location),
      notes: optionalText(r.notes),
    });
  }
  return items.sort((a, b) => a.start.localeCompare(b.start));
}

/** Agenda stored for one event; another event's agenda reads as empty. */
export function agendaForEvent(value: unknown, eventCode: string): AgendaItem[] {
  if (!value || typeof value !== 'object') return [];
  const v = value as { eventCode?: unknown; items?: unknown };
  if (!eventCode || v.eventCode !== eventCode) return [];
  return parseAgenda(v.items);
}

export type ScheduleEntry =
  | { kind: 'agenda'; key: string; start: number; end: number | null; item: AgendaItem }
  | { kind: 'match'; key: string; start: number; end: number | null; match: ScoredMatch };

export type ScheduleState = 'past' | 'now' | 'next' | 'later';

export type ScheduleDay = {
  day: number;
  entries: (ScheduleEntry & { state: ScheduleState })[];
};

/** Matches have no end time; treat one as taking this long. */
const MATCH_LENGTH_MS = 8 * 60_000;

/**
 * The agenda and our matches as one day-by-day list. `now` marks what is on,
 * and the first entry still to come is `next`.
 */
export function buildSchedule(agenda: AgendaItem[], matches: ScoredMatch[], now: number): ScheduleDay[] {
  const entries: ScheduleEntry[] = [
    ...agenda.map((item) => ({
      kind: 'agenda' as const,
      key: `a:${item.id}`,
      start: new Date(item.start).getTime(),
      end: item.end ? new Date(item.end).getTime() : null,
      item,
    })),
    ...matches
      .filter((match) => match.scheduled_time)
      .map((match) => ({
        kind: 'match' as const,
        key: `m:${match.id}`,
        start: new Date(match.scheduled_time!).getTime(),
        end: null,
        match,
      })),
  ].sort((a, b) => a.start - b.start || a.key.localeCompare(b.key));

  let nextAssigned = false;
  const days = new Map<number, ScheduleDay>();
  for (const entry of entries) {
    const end = entry.end ?? entry.start + (entry.kind === 'match' ? MATCH_LENGTH_MS : 0);
    let state: ScheduleState;
    if (entry.kind === 'match' && hasResult(entry.match)) state = 'past';
    else if (now >= entry.start && now < end) state = 'now';
    else if (now >= end && entry.start <= now) state = 'past';
    else if (!nextAssigned) {
      state = 'next';
      nextAssigned = true;
    } else state = 'later';

    const day = localDayNumber(new Date(entry.start));
    const bucket = days.get(day) ?? { day, entries: [] };
    bucket.entries.push({ ...entry, state });
    days.set(day, bucket);
  }
  return [...days.values()].sort((a, b) => a.day - b.day);
}

// ---- Times typed into the agenda editor ---------------------------------------------

/**
 * Minutes after midnight for a typed time: "9:30", "09:30", "14:05", "9:30 am",
 * "2 pm", "930". Null when it isn't a time.
 */
export function parseClockTime(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\./g, '');
  const match = /^(\d{1,2})(?::?(\d{2}))?\s*(am|pm|a|p)?$/.exec(text);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = match[2] ? Number(match[2]) : 0;
  const meridiem = match[3]?.[0];
  if (minutes > 59) return null;
  if (meridiem) {
    if (hours < 1 || hours > 12) return null;
    if (hours === 12) hours = 0;
    if (meridiem === 'p') hours += 12;
  } else if (hours > 23) {
    return null;
  }
  return hours * 60 + minutes;
}

/** A local calendar date ("YYYY-MM-DD") at a time of day, as an ISO timestamp. */
export function localDateTime(date: string, minutes: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const value = new Date(y, m - 1, d, Math.floor(minutes / 60), minutes % 60);
  return Number.isNaN(value.getTime()) ? null : value.toISOString();
}

/** An ISO timestamp as the local date and 24-hour time the editor shows. */
export function splitLocalDateTime(iso: string): { date: string; time: string } {
  const value = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    date: `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`,
    time: `${value.getHours()}:${pad(value.getMinutes())}`,
  };
}
