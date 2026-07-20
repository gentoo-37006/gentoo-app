import { describe, expect, it } from 'vitest';
import { parseMatchesCsv } from '@/lib/csv';

describe('parseMatchesCsv', () => {
  it('parses comma-separated rows', () => {
    const { rows, errors } = parseMatchesCsv('1,101,102,201,202\n2,103,104,203,204');
    expect(errors).toEqual([]);
    expect(rows).toEqual([
      { match_number: 1, red1: 101, red2: 102, blue1: 201, blue2: 202 },
      { match_number: 2, red1: 103, red2: 104, blue1: 203, blue2: 204 },
    ]);
  });

  it('accepts tab-separated rows and blank lines', () => {
    const { rows, errors } = parseMatchesCsv('1\t101\t102\t201\t202\n\n2\t103\t104\t203\t204\n');
    expect(errors).toEqual([]);
    expect(rows.map((r) => r.match_number)).toEqual([1, 2]);
  });

  it('skips a non-numeric header row without reporting an error', () => {
    const { rows, errors } = parseMatchesCsv('Match,Red 1,Red 2,Blue 1,Blue 2\n1,101,102,201,202');
    expect(errors).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0].match_number).toBe(1);
  });

  it('treats a numeric first row as data, not a header', () => {
    const { rows } = parseMatchesCsv('1,101,102,201,202');
    expect(rows).toHaveLength(1);
  });

  it('reports later rows with missing match numbers, with 1-based line numbers', () => {
    const { rows, errors } = parseMatchesCsv('1,101,102,201,202\noops,1,2,3,4\n3,105,106,205,206');
    expect(rows.map((r) => r.match_number)).toEqual([1, 3]);
    expect(errors).toEqual(['Line 2: missing match number']);
  });

  it('extracts digits from decorated cells and leaves missing cells undefined', () => {
    const { rows } = parseMatchesCsv('Q-7,#101,102');
    expect(rows[0]).toEqual({
      match_number: 7,
      red1: 101,
      red2: 102,
      blue1: undefined,
      blue2: undefined,
    });
  });
});
