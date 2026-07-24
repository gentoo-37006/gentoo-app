import type { Priority, ProjectStatus, TaskStatus } from '@/lib/types';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'muted'
  | 'priorityLow'
  | 'priorityMedium'
  | 'priorityHigh'
  | 'priorityUrgent'
  | 'taskTodo'
  | 'taskInProgress'
  | 'taskBlocked'
  | 'taskDone';

export function priorityVariant(p: Priority): BadgeVariant {
  return p === 'urgent'
    ? 'priorityUrgent'
    : p === 'high'
      ? 'priorityHigh'
      : p === 'medium'
        ? 'priorityMedium'
        : 'priorityLow';
}

export function taskStatusVariant(s: TaskStatus): BadgeVariant {
  return s === 'done'
    ? 'taskDone'
    : s === 'blocked'
      ? 'taskBlocked'
      : s === 'in_progress'
        ? 'taskInProgress'
        : 'taskTodo';
}

export function projectStatusVariant(s: ProjectStatus): BadgeVariant {
  return s === 'done'
    ? 'taskDone'
    : s === 'on_hold'
      ? 'taskBlocked'
      : s === 'active'
        ? 'taskInProgress'
        : 'taskTodo';
}

export function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
