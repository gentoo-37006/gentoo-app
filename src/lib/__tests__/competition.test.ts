import { describe, expect, it } from 'vitest';
import {
  agendaForEvent,
  allianceOf,
  awardName,
  buildSchedule,
  eventStatus,
  matchResult,
  matchSides,
  nextMatch,
  ourMatches,
  ourRecord,
  parseAgenda,
  type ScoredMatch,
} from '@/lib/competition';

const US = 37006;
const base = new Date(2026, 10, 25, 9, 0).getTime(); // Nov 25, 9:00 local
const at = (minutes: number) => new Date(base + minutes * 60_000).toISOString();

function match(overrides: Partial<ScoredMatch> & { id: string; match_number: number }): ScoredMatch {
  return {
    label: null,
    scheduled_time: null,
    red1: 1,
    red2: 2,
    blue1: 3,
    blue2: 4,
    ...overrides,
  };
}

const MATCHES: ScoredMatch[] = [
  match({ id: 'q3', match_number: 3, scheduled_time: at(40), blue2: US }),
  match({ id: 'q1', match_number: 1, scheduled_time: at(-30), red1: US, has_been_played: true, red_score: 150, blue_score: 120 }),
  match({ id: 'q2', match_number: 2, scheduled_time: at(10) }),
  match({ id: 'q4', match_number: 4, scheduled_time: at(70), red2: US, has_been_played: true, red_score: 90, blue_score: 90 }),
  match({ id: 'q5', match_number: 5, scheduled_time: at(100), red1: US }),
];

describe('our matches', () => {
  it('finds which alliance we are on', () => {
    expect(allianceOf(MATCHES[0], US)).toBe('blue');
    expect(allianceOf(MATCHES[1], US)).toBe('red');
    expect(allianceOf(MATCHES[2], US)).toBeNull();
  });

  it('keeps only the matches we play in, in schedule order', () => {
    expect(ourMatches(MATCHES, US).map((m) => m.id)).toEqual(['q1', 'q3', 'q4', 'q5']);
  });

  it('puts unscheduled matches last, by number', () => {
    const list = [match({ id: 'b', match_number: 9, red1: US }), match({ id: 'a', match_number: 8, red1: US, scheduled_time: at(0) })];
    expect(ourMatches(list, US).map((m) => m.id)).toEqual(['a', 'b']);
  });

  it('names our partners and opponents', () => {
    expect(matchSides(MATCHES[0], US)).toEqual({ alliance: 'blue', partners: [3], opponents: [1, 2] });
    expect(matchSides(MATCHES[2], US)).toBeNull();
  });
});

describe('results', () => {
  it('scores a played match from our side', () => {
    expect(matchResult(MATCHES[1], US)).toEqual({ outcome: 'win', ours: 150, theirs: 120 });
    expect(matchResult(MATCHES[3], US)?.outcome).toBe('tie');
    const blueLoss = match({ id: 'x', match_number: 9, blue1: US, has_been_played: true, red_score: 80, blue_score: 60 });
    expect(matchResult(blueLoss, US)).toEqual({ outcome: 'loss', ours: 60, theirs: 80 });
  });

  it('has no result before a match is played or for matches without us', () => {
    expect(matchResult(MATCHES[0], US)).toBeNull();
    expect(matchResult(MATCHES[2], US)).toBeNull();
    expect(matchResult(match({ id: 'y', match_number: 9, red1: US, has_been_played: false, red_score: 0, blue_score: 0 }), US)).toBeNull();
  });

  it('counts our record', () => {
    expect(ourRecord(MATCHES, US)).toEqual({ wins: 1, losses: 0, ties: 1 });
  });

  it('picks our next unplayed match', () => {
    expect(nextMatch(MATCHES, US, base)?.id).toBe('q3');
    // q3 started two minutes ago and has no score yet: still "next".
    expect(nextMatch(MATCHES, US, base + 42 * 60_000)?.id).toBe('q3');
    expect(nextMatch(MATCHES, US, base + 60 * 60_000)?.id).toBe('q5');
    expect(nextMatch(MATCHES, US, base + 200 * 60_000)).toBeNull();
  });
});

describe('eventStatus', () => {
  const now = new Date(2026, 10, 25, 12, 0);
  it('counts down to an event', () => {
    expect(eventStatus({ start: '2026-11-28', end: '2026-11-29' }, now)).toEqual({ kind: 'upcoming', label: 'Starts in 3 days' });
    expect(eventStatus({ start: '2026-11-26', end: '2026-11-26' }, now).label).toBe('Starts tomorrow');
  });

  it('says which day of a running event it is', () => {
    expect(eventStatus({ start: '2026-11-24', end: '2026-11-25' }, now)).toEqual({ kind: 'live', label: 'Day 2 of 2' });
    expect(eventStatus({ start: '2026-11-25', end: '2026-11-25' }, now)).toEqual({ kind: 'live', label: 'Today' });
  });

  it('knows when it is over', () => {
    expect(eventStatus({ start: '2026-11-20', end: '2026-11-21' }, now).kind).toBe('finished');
    expect(eventStatus({ start: '2026-11-25', end: '2026-11-25', finished: true }, now).kind).toBe('finished');
  });

  it('falls back to the FTC Scout flags without dates', () => {
    expect(eventStatus({ start: null, end: null, ongoing: true }, now).kind).toBe('live');
    expect(eventStatus({ start: null, end: null }, now).kind).toBe('unknown');
  });
});

describe('awardName', () => {
  it('names judged awards and their places', () => {
    expect(awardName('Think', 1)).toBe('Think Award');
    expect(awardName('Inspire', 2)).toBe('Inspire Award · 2nd place');
    expect(awardName('JudgesChoice', 1)).toBe("Judges' Choice Award");
  });

  it('names alliance results without places, and copes with new types', () => {
    expect(awardName('Winner', 1)).toBe('Winning Alliance');
    expect(awardName('Finalist', 2)).toBe('Finalist Alliance');
    expect(awardName('SomeNewAward', 1)).toBe('Some New Award');
  });
});

describe('agenda', () => {
  const raw = [
    { id: 'b', kind: 'judging', title: ' Judging interview ', start: at(60), end: at(75), location: 'Room 204', notes: '' },
    { id: 'a', kind: 'arrival', title: 'Load in', start: at(-120), end: null },
    { id: 'c', kind: 'mystery', title: 'Unknown kind', start: at(300) },
    { id: 'd', kind: 'other', title: '', start: at(10) },
    { id: 'e', kind: 'other', title: 'Bad time', start: 'soon' },
    { id: 'f', kind: 'other', title: 'Ends before start', start: at(10), end: at(5) },
    'junk',
  ];

  it('keeps well-formed items, sorted, and repairs what it can', () => {
    const items = parseAgenda(raw);
    expect(items.map((i) => i.id)).toEqual(['a', 'f', 'b', 'c']);
    expect(items[2]).toMatchObject({ title: 'Judging interview', location: 'Room 204', notes: null });
    expect(items[3].kind).toBe('other');
    expect(items[1].end).toBeNull();
    expect(parseAgenda(null)).toEqual([]);
  });

  it("ignores another event's agenda", () => {
    expect(agendaForEvent({ eventCode: 'CAONCMP', items: raw }, 'CAONCMP')).toHaveLength(4);
    expect(agendaForEvent({ eventCode: 'OLD', items: raw }, 'CAONCMP')).toEqual([]);
    expect(agendaForEvent({ eventCode: 'CAONCMP', items: raw }, '')).toEqual([]);
  });

  it('merges the agenda with our matches and marks now and next', () => {
    const agenda = parseAgenda([
      { id: 'arrive', kind: 'arrival', title: 'Load in', start: at(-120), end: at(-60) },
      { id: 'judge', kind: 'judging', title: 'Judging interview', start: at(-5), end: at(10) },
      { id: 'ceremony', kind: 'ceremony', title: 'Opening ceremony', start: at(30) },
    ]);
    const [day] = buildSchedule(agenda, ourMatches(MATCHES, US), base);
    expect(day.entries.map((e) => [e.key, e.state])).toEqual([
      ['a:arrive', 'past'],
      ['m:q1', 'past'],
      ['a:judge', 'now'],
      ['a:ceremony', 'next'],
      ['m:q3', 'later'],
      ['m:q4', 'past'],
      ['m:q5', 'later'],
    ]);
  });

  it('groups entries by day', () => {
    const agenda = parseAgenda([
      { id: 'd2', kind: 'awards', title: 'Awards', start: new Date(2026, 10, 26, 15).toISOString() },
    ]);
    const days = buildSchedule(agenda, ourMatches(MATCHES, US), base);
    expect(days).toHaveLength(2);
    expect(days[1].entries[0].key).toBe('a:d2');
  });
});

describe('typed times', () => {
  it('reads 24-hour and 12-hour times', async () => {
    const { parseClockTime } = await import('@/lib/competition');
    expect(parseClockTime('9:30')).toBe(570);
    expect(parseClockTime('09:30')).toBe(570);
    expect(parseClockTime('14:05')).toBe(845);
    expect(parseClockTime('930')).toBe(570);
    expect(parseClockTime('9:30 am')).toBe(570);
    expect(parseClockTime('2 PM')).toBe(840);
    expect(parseClockTime('12:15 a.m.')).toBe(15);
    expect(parseClockTime('12 pm')).toBe(720);
  });

  it('rejects things that are not times', async () => {
    const { parseClockTime } = await import('@/lib/competition');
    for (const bad of ['', 'noon', '25:00', '9:75', '13 pm', '0 am']) expect(parseClockTime(bad)).toBeNull();
  });

  it('round-trips a local date and time', async () => {
    const { localDateTime, splitLocalDateTime } = await import('@/lib/competition');
    const iso = localDateTime('2026-11-28', 9 * 60 + 5)!;
    expect(new Date(iso).getHours()).toBe(9);
    expect(splitLocalDateTime(iso)).toEqual({ date: '2026-11-28', time: '9:05' });
    expect(localDateTime('Nov 28', 60)).toBeNull();
  });
});
