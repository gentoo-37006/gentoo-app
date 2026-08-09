import { describe, expect, it, vi } from 'vitest';
import { labelSheetHtml } from '@/lib/inventory-label';
import type { Part } from '@/lib/types';

vi.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

vi.mock('@/lib/app-version', () => ({
  APP_VERSION: '1.0.0',
}));

const part = (overrides: Partial<Part> = {}): Part => ({
  id: 'part-1',
  name: 'HD Hex Motor',
  part_number: 'REV-41-1301',
  manufacturer: 'REV Robotics',
  category: 'motor',
  location: 'Bin A2',
  notes: null,
  quantity: 8,
  consumable: false,
  unit: null,
  low_stock_at: 2,
  image_path: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('labelSheetHtml', () => {
  it('prints the category and manufacturer', () => {
    const html = labelSheetHtml([part()]);

    expect(html).toContain('Motors | REV Robotics');
  });

  it('prints the part number without the storage location', () => {
    const html = labelSheetHtml([part()]);

    expect(html).toContain('<div class="meta">REV-41-1301</div>');
    expect(html).not.toContain('Bin A2');
  });

  it('prints the category when the manufacturer is missing', () => {
    const html = labelSheetHtml([part({ manufacturer: null })]);

    expect(html).toContain('<div class="meta">Motors</div>');
  });

  it('escapes manufacturer text', () => {
    const html = labelSheetHtml([part({ manufacturer: 'A&B <Parts>' })]);

    expect(html).toContain('Motors | A&amp;B &lt;Parts&gt;');
  });
});
