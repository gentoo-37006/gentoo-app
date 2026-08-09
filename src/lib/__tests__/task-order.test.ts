import { describe, expect, it } from 'vitest';
import { SORT_STEP, nextTaskSortOrder } from '@/lib/task-order';

describe('nextTaskSortOrder', () => {
  it('places a new task above every existing one', () => {
    // Lists render sort_order ASC, so "top" means strictly smaller.
    const existing = [{ sort_order: 10 }, { sort_order: 20 }, { sort_order: 30 }];

    const next = nextTaskSortOrder(existing);

    expect(next).toBeLessThan(Math.min(...existing.map((t) => t.sort_order)));
  });

  it('stays above tasks that already have negative orders', () => {
    // Adding several tasks in a row must keep stacking upward, not collide.
    const existing = [{ sort_order: -10 }, { sort_order: 10 }];

    expect(nextTaskSortOrder(existing)).toBe(-20);
  });

  it('keeps each successive creation on top of the last', () => {
    const tasks: { sort_order: number }[] = [{ sort_order: 10 }];

    for (let i = 0; i < 3; i += 1) {
      const next = nextTaskSortOrder(tasks);
      expect(next).toBeLessThan(Math.min(...tasks.map((t) => t.sort_order)));
      tasks.push({ sort_order: next });
    }
  });

  it('handles the first task in an empty project', () => {
    // Math.min() with no arguments is Infinity, which would poison the result.
    expect(nextTaskSortOrder([])).toBe(-SORT_STEP);
    expect(Number.isFinite(nextTaskSortOrder([]))).toBe(true);
  });

  it('treats a missing or null order as zero', () => {
    expect(nextTaskSortOrder([{ sort_order: null }, {}])).toBe(-SORT_STEP);
  });

  it('is unaffected by the input order', () => {
    const ascending = [{ sort_order: 10 }, { sort_order: 50 }];
    const descending = [{ sort_order: 50 }, { sort_order: 10 }];

    expect(nextTaskSortOrder(ascending)).toBe(nextTaskSortOrder(descending));
  });
});
