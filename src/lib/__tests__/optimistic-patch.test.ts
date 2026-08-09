import { describe, expect, it } from 'vitest';
import {
  removeById,
  removeTaskFromProject,
  updateAll,
  updateById,
  updateTaskInProject,
} from '@/lib/optimistic-patch';

const rows = () => [
  { id: 'a', title: 'Alpha', read: false },
  { id: 'b', title: 'Beta', read: false },
];

describe('updateById', () => {
  it('patches only the matching row', () => {
    const next = updateById(rows(), 'b', { read: true })!;

    expect(next.map((r) => r.read)).toEqual([false, true]);
    expect(next[1].title).toBe('Beta');
  });

  it('never mutates the cached array or its rows', () => {
    // A mutated cache has nothing left to roll back to when the request fails.
    const list = rows();
    const before = JSON.parse(JSON.stringify(list));

    const next = updateById(list, 'a', { read: true })!;

    expect(list).toEqual(before);
    expect(next).not.toBe(list);
    expect(next[0]).not.toBe(list[0]);
  });

  it('returns the SAME reference when the id is absent', () => {
    // Identity is the signal applyOptimistic uses to skip snapshotting an
    // untouched cache, so an unrelated key is never rolled back later.
    const list = rows();

    expect(updateById(list, 'missing', { read: true })).toBe(list);
  });

  it('tolerates an unloaded cache', () => {
    // Explicit type argument: `undefined` gives inference nothing to work from.
    expect(updateById<{ id: string; read: boolean }>(undefined, 'a', { read: true })).toBeUndefined();
  });
});

describe('removeById', () => {
  it('drops the row', () => {
    expect(removeById(rows(), 'a')!.map((r) => r.id)).toEqual(['b']);
  });

  it('returns the same reference when nothing matched', () => {
    const list = rows();

    expect(removeById(list, 'missing')).toBe(list);
  });

  it('does not mutate the input', () => {
    const list = rows();
    removeById(list, 'a');

    expect(list).toHaveLength(2);
  });
});

describe('updateAll', () => {
  it('patches every row without mutating', () => {
    const list = rows();
    const next = updateAll(list, { read: true })!;

    expect(next.every((r) => r.read)).toBe(true);
    expect(list.every((r) => !r.read)).toBe(true);
  });
});

describe('project detail helpers', () => {
  const detail = () => ({
    project: { id: 'p1', name: 'Pit readiness' },
    tasks: [
      { id: 't1', title: 'One', status: 'todo' },
      { id: 't2', title: 'Two', status: 'todo' },
    ],
  });

  it('patches a task without disturbing the project', () => {
    const data = detail();
    const next = updateTaskInProject(data, 't2', { status: 'done' })!;

    expect(next.tasks[1].status).toBe('done');
    expect(next.project).toBe(data.project);
    expect(data.tasks[1].status).toBe('todo');
  });

  it('removes a task without disturbing the project', () => {
    const data = detail();
    const next = removeTaskFromProject(data, 't1')!;

    expect(next.tasks.map((t) => t.id)).toEqual(['t2']);
    expect(next.project).toBe(data.project);
    expect(data.tasks).toHaveLength(2);
  });

  it('returns the same object when the task is in another project', () => {
    const data = detail();

    expect(updateTaskInProject(data, 'elsewhere', { status: 'done' })).toBe(data);
    expect(removeTaskFromProject(data, 'elsewhere')).toBe(data);
  });

  it('tolerates an unloaded cache', () => {
    type Detail = { tasks: { id: string; status: string }[] };
    expect(updateTaskInProject<Detail>(undefined, 't1', { status: 'done' })).toBeUndefined();
    expect(removeTaskFromProject<Detail>(undefined, 't1')).toBeUndefined();
  });
});
