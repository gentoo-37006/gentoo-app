import { describe, expect, it } from 'vitest';
import { currentSeason } from '@/lib/api/ftcscout';

describe('currentSeason', () => {
  // FTC labels a season by the year it starts: the "2025" season runs from
  // kickoff in September 2025 through championships in spring 2026.
  it('uses the previous year before September', () => {
    expect(currentSeason(new Date(2026, 0, 15))).toBe(2025); // January
    expect(currentSeason(new Date(2026, 6, 27))).toBe(2025); // July
    expect(currentSeason(new Date(2026, 7, 31))).toBe(2025); // August 31
  });

  it('rolls over at the September kickoff', () => {
    expect(currentSeason(new Date(2026, 8, 1))).toBe(2026); // September 1
    expect(currentSeason(new Date(2026, 11, 25))).toBe(2026); // December
  });

  it('keeps the same season across the new year', () => {
    expect(currentSeason(new Date(2026, 9, 1))).toBe(2026);
    expect(currentSeason(new Date(2027, 2, 1))).toBe(2026);
  });
});
