-- 0017_tasks_trash: soft-delete ("trash") support for tasks

alter table public.tasks add column deleted_at timestamptz;

create index tasks_project_deleted_at_idx
  on public.tasks (project_id, deleted_at);

-- Moving to trash and restoring use the existing tasks UPDATE policy.
-- Permanent deletion uses the existing tasks DELETE policy.
