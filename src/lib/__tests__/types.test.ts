import { describe, expect, it } from 'vitest';
import { matchLabelFor, matchTeamNumbers, matchTitle } from '@/lib/types';

describe('matchLabelFor', () => {
  it('leaves qualification matches unlabelled so they read as "Match N"', () => {
    expect(matchLabelFor('Quals', 0)).toBeNull();
  });

  it('names playoff matches by their bracket series', () => {
    // FTC Scout ids these from 21001 up, so without a label they show as
    // "Match 21001" in the app and in Discord scouting pings.
    expect(matchLabelFor('DoubleElim', 3)).toBe('Playoff 3');
    expect(matchLabelFor('Finals', 2)).toBe('Final 2');
    expect(matchLabelFor('Semis', 1)).toBe('Semi 1');
  });

  it('drops the number when a level has no series', () => {
    expect(matchLabelFor('Finals', 0)).toBe('Final');
    expect(matchLabelFor('Finals', null)).toBe('Final');
  });

  it('passes through an unrecognized level rather than inventing one', () => {
    expect(matchLabelFor('Practice', 2)).toBe('Practice 2');
  });

  it('falls back to no label when the level is missing', () => {
    expect(matchLabelFor(null, 1)).toBeNull();
    expect(matchLabelFor(undefined, undefined)).toBeNull();
  });
});

describe('matchTitle', () => {
  it('prefers the label', () => {
    expect(matchTitle({ label: 'Playoff 3', match_number: 21001 })).toBe('Playoff 3');
  });

  it('falls back to the match number', () => {
    expect(matchTitle({ label: null, match_number: 12 })).toBe('Match 12');
  });
});

describe('matchTeamNumbers', () => {
  it('returns red then blue, skipping empty slots', () => {
    expect(matchTeamNumbers({ red1: 11248, red2: null, blue1: 7244, blue2: 3596 })).toEqual([
      11248, 7244, 3596,
    ]);
  });
});
