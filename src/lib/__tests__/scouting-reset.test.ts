import { describe, expect, it } from 'vitest';
import { describeReset, scoutingResetSteps } from '@/lib/scouting-reset';

describe('scoutingResetSteps', () => {
  it('removes match reports before the assignments they point at', () => {
    expect(scoutingResetSteps({ pit: false, matches: true, picklist: false })).toEqual([
      { action: 'delete', table: 'match_reports' },
      { action: 'delete', table: 'scouting_assignments' },
    ]);
  });

  it('removes pit reports and clears team notes', () => {
    expect(scoutingResetSteps({ pit: true, matches: false, picklist: false })).toEqual([
      { action: 'delete', table: 'pit_scouting_entries' },
      { action: 'clear', table: 'scouted_teams', columns: ['notes'] },
    ]);
  });

  it('clears the picklist in one update alongside team notes', () => {
    expect(scoutingResetSteps({ pit: true, matches: true, picklist: true })).toEqual([
      { action: 'delete', table: 'match_reports' },
      { action: 'delete', table: 'scouting_assignments' },
      { action: 'delete', table: 'pit_scouting_entries' },
      { action: 'clear', table: 'scouted_teams', columns: ['notes', 'picklist_tier', 'picklist_rank', 'picklist_notes'] },
    ]);
  });

  it('never touches matches or the team roster', () => {
    const tables = scoutingResetSteps({ pit: true, matches: true, picklist: true }).map((s) => s.table);
    expect(tables).not.toContain('matches');
    expect(scoutingResetSteps({ pit: true, matches: true, picklist: true }).filter((s) => s.table === 'scouted_teams')).toEqual([
      expect.objectContaining({ action: 'clear' }),
    ]);
  });

  it('does nothing when nothing is chosen', () => {
    expect(scoutingResetSteps({ pit: false, matches: false, picklist: false })).toEqual([]);
  });
});

describe('describeReset', () => {
  it('summarises what went', () => {
    expect(describeReset({ pit_scouting_entries: 12, match_reports: 1, scouting_assignments: 40, scouted_teams: 24 })).toBe(
      'Removed 12 pit reports, 1 match report, 40 assignments; cleared 24 teams.'
    );
    expect(describeReset({ scouted_teams: 1 })).toBe('Cleared 1 team.');
    expect(describeReset({ match_reports: 0 })).toBe('There was nothing to reset.');
  });
});
