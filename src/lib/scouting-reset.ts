/**
 * What "reset scouting data" removes, as an ordered list of table operations.
 *
 * Kept pure so the choice of tables is tested apart from Supabase. The order
 * matters: match reports point at assignments (on delete set null), so they go
 * first; pit answers cascade with their entries. Matches, the team roster and
 * official standings are not scouting — they come back from the FTC Scout
 * sync — so a reset never touches them.
 */

export type ScoutingResetOptions = {
  /** Pit scouting reports (with their answers) and per-team notes. */
  pit: boolean;
  /** Match scouting reports and scouter assignments. */
  matches: boolean;
  /** Picklist tiers, order and notes. */
  picklist: boolean;
};

export type ScoutingResetStep =
  | { action: 'delete'; table: 'match_reports' | 'scouting_assignments' | 'pit_scouting_entries' }
  | { action: 'clear'; table: 'scouted_teams'; columns: ('notes' | 'picklist_tier' | 'picklist_rank' | 'picklist_notes')[] };

export const RESET_PARTS: { key: keyof ScoutingResetOptions; label: string; detail: string }[] = [
  { key: 'pit', label: 'Pit scouting', detail: 'Every pit report and its answers, and the notes on each team.' },
  { key: 'matches', label: 'Match scouting', detail: 'Every match report and every scouter assignment.' },
  { key: 'picklist', label: 'Picklist', detail: 'Tiers, order and picklist notes for every team.' },
];

export function scoutingResetSteps(options: ScoutingResetOptions): ScoutingResetStep[] {
  const steps: ScoutingResetStep[] = [];
  if (options.matches) {
    steps.push({ action: 'delete', table: 'match_reports' });
    steps.push({ action: 'delete', table: 'scouting_assignments' });
  }
  if (options.pit) steps.push({ action: 'delete', table: 'pit_scouting_entries' });

  const columns: Extract<ScoutingResetStep, { action: 'clear' }>['columns'] = [];
  if (options.pit) columns.push('notes');
  if (options.picklist) columns.push('picklist_tier', 'picklist_rank', 'picklist_notes');
  if (columns.length > 0) steps.push({ action: 'clear', table: 'scouted_teams', columns });
  return steps;
}

export type ScoutingResetResult = Partial<Record<ScoutingResetStep['table'], number>>;

/** "Removed 12 pit reports and 30 match reports; cleared 24 teams." */
export function describeReset(result: ScoutingResetResult): string {
  const parts: string[] = [];
  const count = (n: number | undefined, one: string, many: string) =>
    n ? `${n} ${n === 1 ? one : many}` : null;
  const removed = [
    count(result.pit_scouting_entries, 'pit report', 'pit reports'),
    count(result.match_reports, 'match report', 'match reports'),
    count(result.scouting_assignments, 'assignment', 'assignments'),
  ].filter(Boolean);
  if (removed.length > 0) parts.push(`Removed ${removed.join(', ')}`);
  if (result.scouted_teams) parts.push(`cleared ${result.scouted_teams} ${result.scouted_teams === 1 ? 'team' : 'teams'}`);
  if (parts.length === 0) return 'There was nothing to reset.';
  const text = parts.join('; ');
  return `${text[0].toUpperCase()}${text.slice(1)}.`;
}
