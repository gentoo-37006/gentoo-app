/**
 * Where tapping a notification should take the user, or null to stay put.
 * Works for both in-app rows (typed `type` field) and push payloads (type
 * rides inside `data`, and old payloads may lack it entirely — a projectId
 * still identifies a task notification).
 */
export function hrefForNotification(n: {
  type?: string | null;
  data?: unknown;
}): string | null {
  const data = (n.data ?? {}) as Record<string, unknown>;
  const projectId =
    typeof data.projectId === 'string' && data.projectId ? data.projectId : null;
  const taskId = typeof data.taskId === 'string' && data.taskId ? data.taskId : null;
  const taskHref = projectId
    ? taskId
      ? `/tasks/${projectId}?task=${taskId}`
      : `/tasks/${projectId}`
    : null;
  const type = n.type ?? (typeof data.type === 'string' ? data.type : null);

  switch (type) {
    case 'task':
      return taskHref;
    case 'talkie_request':
    case 'talkie_claimed':
    case 'talkie_resolved':
      return '/talkie';
    case 'assignment':
    case 'match_report':
      return '/scouting/matches';
    case 'approval':
      return '/admin';
    default:
      return taskHref;
  }
}
