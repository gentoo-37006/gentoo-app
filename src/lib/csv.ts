export type ParsedMatch = {
  match_number: number;
  red1?: number;
  red2?: number;
  blue1?: number;
  blue2?: number;
};

const toInt = (v?: string): number | undefined => {
  const n = parseInt((v ?? '').replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * Parse a match schedule pasted as CSV. Expected columns:
 *   match number, red1, red2, blue1, blue2
 * A non-numeric first row is treated as a header and skipped.
 */
export function parseMatchesCsv(text: string): { rows: ParsedMatch[]; errors: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const rows: ParsedMatch[] = [];
  const errors: string[] = [];

  lines.forEach((line, i) => {
    const cols = line.split(/[,\t]/).map((c) => c.trim());
    const matchNumber = toInt(cols[0]);
    if (i === 0 && matchNumber === undefined) return; // header row
    if (matchNumber === undefined) {
      errors.push(`Line ${i + 1}: missing match number`);
      return;
    }
    rows.push({
      match_number: matchNumber,
      red1: toInt(cols[1]),
      red2: toInt(cols[2]),
      blue1: toInt(cols[3]),
      blue2: toInt(cols[4]),
    });
  });

  return { rows, errors };
}
