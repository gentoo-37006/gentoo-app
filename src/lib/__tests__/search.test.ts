import { describe, expect, it } from 'vitest';
import { matchesSearch, searchTokens } from '@/lib/search';

/** The real inventory rows these rules were written against. */
const U_CHANNEL = ['goBILDA 1120 Series U-Channel', '1120-0043-0288', 'Bin C1', 'Structure'];
const ODOMETRY = ['goBILDA 4-Bar Odometry Pod', '3110-0001-0002', 'Shelf B', 'Electronics'];
const MOTOR = ['goBILDA 5203 Yellow Jacket - 435rpm', '5203-2402-0014', 'Bin A2', 'Motors'];

describe('searchTokens', () => {
  it('splits on any non-alphanumeric run', () => {
    expect(searchTokens('u-channel')).toEqual(['u', 'channel']);
    expect(searchTokens('3110-0001/0002')).toEqual(['3110', '0001', '0002']);
  });

  it('collapses repeated separators and trims', () => {
    expect(searchTokens('  odom   ---  pod ')).toEqual(['odom', 'pod']);
  });

  it('returns nothing for a query with no letters or digits', () => {
    expect(searchTokens('')).toEqual([]);
    expect(searchTokens('---')).toEqual([]);
  });
});

describe('matchesSearch', () => {
  it('ignores punctuation differences (the U-Channel case)', () => {
    for (const query of ['u channel', 'u-channel', 'U/Channel', 'uchannel'.replace('u', 'u ')]) {
      expect(matchesSearch(U_CHANNEL, query)).toBe(true);
    }
  });

  it('does not require the tokens to be contiguous (the Odometry Pod case)', () => {
    expect(matchesSearch(ODOMETRY, 'odom pod')).toBe(true);
  });

  it('matches tokens in any order', () => {
    expect(matchesSearch(ODOMETRY, 'pod odom')).toBe(true);
  });

  it('matches partial words, not just word starts', () => {
    // "bilda" sits inside "goBILDA".
    expect(matchesSearch(ODOMETRY, 'bilda')).toBe(true);
  });

  it('still requires EVERY token to appear', () => {
    expect(matchesSearch(ODOMETRY, 'odom sprocket')).toBe(false);
  });

  it('searches across all fields, not just the name', () => {
    expect(matchesSearch(MOTOR, 'bin a2')).toBe(true);
    expect(matchesSearch(MOTOR, '2402')).toBe(true);
    expect(matchesSearch(MOTOR, 'motors')).toBe(true);
  });

  it('can combine tokens from different fields', () => {
    // "yellow" is in the name, "a2" is in the location.
    expect(matchesSearch(MOTOR, 'yellow a2')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(matchesSearch(MOTOR, 'YELLOW JACKET')).toBe(true);
  });

  it('treats an empty or punctuation-only query as no filter', () => {
    // A stray "-" mid-typing must not blank the list.
    expect(matchesSearch(MOTOR, '')).toBe(true);
    expect(matchesSearch(MOTOR, '-')).toBe(true);
  });

  it('skips missing fields without matching them', () => {
    expect(matchesSearch(['Zip ties', null, undefined, 'Hardware'], 'zip hardware')).toBe(true);
    expect(matchesSearch(['Zip ties', null, undefined, 'Hardware'], 'zip bin')).toBe(false);
  });

  it('still matches anything the old contiguous search matched', () => {
    // Regression guard: the old behaviour was a plain substring test, so every
    // query that worked before must keep working.
    expect(matchesSearch(MOTOR, 'yellow jacket')).toBe(true);
    expect(matchesSearch(MOTOR, '5203-2402-0014')).toBe(true);
    expect(matchesSearch(U_CHANNEL, '1120 Series')).toBe(true);
  });

  it('normalises accents consistently on both sides', () => {
    // Both reduce to the same tokens, so a name still finds itself.
    expect(matchesSearch(['Café spacer'], 'café')).toBe(true);
    expect(matchesSearch(['Café spacer'], 'caf')).toBe(true);
  });
});
