import { describe, expect, it } from 'vitest';
import { distinctManufacturers, groupPartsByCategory } from '@/lib/inventory-sort';
import type { PartCategory } from '@/lib/types';

const part = (name: string, category: PartCategory) => ({ name, category });

describe('groupPartsByCategory', () => {
  it('groups parts by category', () => {
    const groups = groupPartsByCategory([
      part('REV Control Hub', 'electronics'),
      part('HD Hex Motor', 'motor'),
      part('Expansion Hub', 'electronics'),
    ]);

    expect(groups.map((g) => g.label)).toEqual(['Electronics', 'Motors']);
    expect(groups[0].parts.map((p) => p.name)).toEqual(['Expansion Hub', 'REV Control Hub']);
  });

  it('orders categories alphabetically by their LABEL, not the stored value', () => {
    // The Postgres enum is declared motor, servo, electronics, wiring, … so
    // anything relying on enum/insert order would come back in that order.
    const groups = groupPartsByCategory([
      part('a', 'wiring'),
      part('b', 'motor'),
      part('c', 'electronics'),
      part('d', 'tool'),
      part('e', 'hardware'),
    ]);

    expect(groups.map((g) => g.label)).toEqual([
      'Electronics',
      'Hardware',
      'Motors',
      'Tools',
      'Wiring',
    ]);
  });

  it('orders parts alphabetically inside a category', () => {
    const groups = groupPartsByCategory([
      part('Zip ties', 'hardware'),
      part('Axle', 'hardware'),
      part('M4 screws', 'hardware'),
    ]);

    expect(groups[0].parts.map((p) => p.name)).toEqual(['Axle', 'M4 screws', 'Zip ties']);
  });

  it('sorts case-insensitively', () => {
    const groups = groupPartsByCategory([
      part('banana connector', 'wiring'),
      part('Anderson PowerPole', 'wiring'),
      part('cable tie', 'wiring'),
    ]);

    expect(groups[0].parts.map((p) => p.name)).toEqual([
      'Anderson PowerPole',
      'banana connector',
      'cable tie',
    ]);
  });

  it('sorts embedded numbers naturally', () => {
    // Plain string ordering would put "Bin 10" before "Bin 2".
    const groups = groupPartsByCategory([
      part('Motor 10', 'motor'),
      part('Motor 2', 'motor'),
      part('Motor 1', 'motor'),
    ]);

    expect(groups[0].parts.map((p) => p.name)).toEqual(['Motor 1', 'Motor 2', 'Motor 10']);
  });

  it('omits categories that have no parts', () => {
    const groups = groupPartsByCategory([part('HD Hex Motor', 'motor')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].category).toBe('motor');
  });

  it('returns nothing for an empty inventory', () => {
    expect(groupPartsByCategory([])).toEqual([]);
  });

  it('still shows a part whose category has no configured label', () => {
    // An enum value added in SQL before the app knows about it must not make
    // the part disappear from the list.
    const groups = groupPartsByCategory([part('Mystery', 'pneumatics' as PartCategory)]);

    expect(groups[0].label).toBe('pneumatics');
    expect(groups[0].parts.map((p) => p.name)).toEqual(['Mystery']);
  });

  it('does not mutate the input array', () => {
    const input = [part('Zip ties', 'hardware'), part('Axle', 'hardware')];
    const before = input.map((p) => p.name);

    groupPartsByCategory(input);

    expect(input.map((p) => p.name)).toEqual(before);
  });
});

describe('distinctManufacturers', () => {
  const parts = (...names: (string | null)[]) => names.map((manufacturer) => ({ manufacturer }));

  it('lists each manufacturer once, alphabetically', () => {
    expect(
      distinctManufacturers(parts('REV Robotics', 'goBILDA', 'AndyMark', 'goBILDA'))
    ).toEqual(['AndyMark', 'goBILDA', 'REV Robotics']);
  });

  it('dedupes case and whitespace differences, keeping the first spelling', () => {
    // Free text drifts; three spellings of one maker must not become three tags.
    expect(distinctManufacturers(parts('goBILDA', 'Gobilda', '  GOBILDA  '))).toEqual(['goBILDA']);
  });

  it('skips parts with no manufacturer', () => {
    expect(distinctManufacturers(parts(null, '', '   ', 'REV Robotics'))).toEqual(['REV Robotics']);
  });

  it('caps the suggestion list', () => {
    const many = parts(...Array.from({ length: 20 }, (_, i) => `Maker ${i}`));

    expect(distinctManufacturers(many)).toHaveLength(8);
    expect(distinctManufacturers(many, 3)).toHaveLength(3);
  });

  it('returns nothing for an empty inventory', () => {
    expect(distinctManufacturers([])).toEqual([]);
  });
});
