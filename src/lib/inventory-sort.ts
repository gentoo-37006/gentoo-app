import { PART_CATEGORIES, type Part, type PartCategory } from '@/lib/types';

/**
 * Inventory ordering and lists derived from the parts a team already owns.
 *
 * Ordering: parts used to carry a hand-dragged `sort_order`; the list
 * is now derived entirely from the data:
 *
 *   1. grouped by category
 *   2. categories A-Z
 *   3. parts A-Z inside each category
 *
 * Sorting happens here rather than in the SQL query on purpose. `category` is a
 * Postgres enum declared in domain order (motor, servo, electronics, …), so
 * `ORDER BY category` would sort by that declaration order, not alphabetically.
 * The user-facing LABEL is also not the stored value ('material' → 'Materials'),
 * and it is the label people actually read down the screen.
 */

export type PartGroup<T> = {
  category: PartCategory;
  label: string;
  parts: T[];
};

const LABEL_BY_CATEGORY = new Map(PART_CATEGORIES.map((c) => [c.value, c.label]));

/** Case-insensitive and digit-aware, so "Bin 2" sorts before "Bin 10". */
function compareNames(a: string, b: string): number {
  return a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true });
}

/** Only the fields the ordering depends on, so tests and callers stay flexible. */
type Sortable = Pick<Part, 'category' | 'name'>;

export function groupPartsByCategory<T extends Sortable>(
  parts: readonly T[]
): PartGroup<T>[] {
  const byCategory = new Map<PartCategory, T[]>();
  for (const part of parts) {
    const existing = byCategory.get(part.category);
    if (existing) existing.push(part);
    else byCategory.set(part.category, [part]);
  }

  return [...byCategory.entries()]
    .map(([category, group]) => ({
      category,
      // A part whose category is not in PART_CATEGORIES (an enum value added in
      // SQL but not yet in the app) still gets a heading rather than vanishing.
      label: LABEL_BY_CATEGORY.get(category) ?? category,
      parts: [...group].sort((a, b) => compareNames(a.name, b.name)),
    }))
    .sort((a, b) => compareNames(a.label, b.label));
}

/**
 * Manufacturers already in use, A-Z, deduplicated case-insensitively.
 *
 * Offered as suggestions when adding a part so the field stays consistent —
 * free text otherwise drifts into "goBILDA", "Gobilda" and "go bilda" sitting
 * beside each other as three different makers. The first spelling entered for
 * a given maker wins.
 */
export function distinctManufacturers(
  parts: readonly { manufacturer?: string | null }[],
  limit = 8
): string[] {
  const seen = new Map<string, string>();
  for (const part of parts) {
    const name = part.manufacturer?.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].sort(compareNames).slice(0, limit);
}
