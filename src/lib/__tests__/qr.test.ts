import { describe, expect, it } from 'vitest';
import { qrPath } from '@/lib/qr';

const MARGIN = 2;

/** The path is a run of 1x1 squares: "M<col> <row>h1v1h-1z". */
function modules(path: string): Set<string> {
  const found = new Set<string>();
  for (const [, col, row] of path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    found.add(`${col},${row}`);
  }
  return found;
}

describe('qrPath', () => {
  const { path, size } = qrPath('https://example.com/inventory/abc');
  const dark = modules(path);

  it('sizes the viewBox to a valid QR version plus the quiet zone', () => {
    const version = (size - MARGIN * 2 - 17) / 4;
    expect(Number.isInteger(version)).toBe(true);
    expect(version).toBeGreaterThanOrEqual(1);
  });

  it('draws a finder pattern in each of the three positioning corners', () => {
    const last = size - MARGIN - 7;
    for (const [col, row] of [
      [MARGIN, MARGIN],
      [last, MARGIN],
      [MARGIN, last],
    ]) {
      // Finder = filled 7x7 border with a 3x3 core, so the corner and the
      // centre are dark while the ring between them is light.
      expect(dark.has(`${col},${row}`)).toBe(true);
      expect(dark.has(`${col + 3},${row + 3}`)).toBe(true);
      expect(dark.has(`${col + 1},${row + 1}`)).toBe(false);
    }
  });

  it('grows with the length of the encoded text', () => {
    expect(qrPath('x'.repeat(200)).size).toBeGreaterThan(size);
  });
});
