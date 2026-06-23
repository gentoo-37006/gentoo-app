import type { Priority, ProjectStatus, TaskStatus } from '@/lib/types';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'muted';

export function priorityVariant(p: Priority): BadgeVariant {
  return p === 'urgent' ? 'destructive' : p === 'high' ? 'warning' : p === 'medium' ? 'secondary' : 'muted';
}

export function taskStatusVariant(s: TaskStatus): BadgeVariant {
  return s === 'done' ? 'success' : s === 'blocked' ? 'destructive' : s === 'in_progress' ? 'default' : 'muted';
}

export function projectStatusVariant(s: ProjectStatus): BadgeVariant {
  return s === 'done' ? 'success' : s === 'on_hold' ? 'warning' : s === 'active' ? 'default' : 'muted';
}

export function labelOf<T extends string>(options: { value: T; label: string }[], value: T): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
