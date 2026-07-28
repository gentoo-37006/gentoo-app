-- ============================================================================
-- 0023_auto_unblock_tasks: release blocked tasks when their blocker is done
-- ============================================================================

-- Keep blocker completion lookups narrow as the task table grows.
create index if not exists tasks_blocked_by_active_idx
  on public.tasks (blocked_by)
  where blocked_by is not null and status = 'blocked';

create index if not exists tasks_blocked_by_project_active_idx
  on public.tasks (blocked_by_project)
  where blocked_by_project is not null and status = 'blocked';

create or replace function public.unblock_tasks_after_task_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  with unblocked as (
    update public.tasks
    set
      status = 'todo',
      blocked_by = null,
      blocked_by_project = null,
      updated_at = now()
    where status = 'blocked'
      and blocked_by = new.id
    returning id, project_id, title, assignee_ids
  )
  insert into public.notifications (user_id, type, title, body, data)
  select distinct
    assignee.user_id,
    'task'::public.notification_type,
    'Task unblocked',
    format('Your task "%s" has been unblocked because "%s" is done.', unblocked.title, new.title),
    jsonb_build_object(
      'projectId', unblocked.project_id,
      'taskId', unblocked.id
    )
  from unblocked
  cross join lateral unnest(unblocked.assignee_ids) as assignee(user_id)
  where assignee.user_id is not null;

  return new;
end;
$func$;

create or replace function public.unblock_tasks_after_project_done()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  with unblocked as (
    update public.tasks
    set
      status = 'todo',
      blocked_by = null,
      blocked_by_project = null,
      updated_at = now()
    where status = 'blocked'
      and blocked_by_project = new.id
    returning id, project_id, title, assignee_ids
  )
  insert into public.notifications (user_id, type, title, body, data)
  select distinct
    assignee.user_id,
    'task'::public.notification_type,
    'Task unblocked',
    format('Your task "%s" has been unblocked because "%s" is done.', unblocked.title, new.name),
    jsonb_build_object(
      'projectId', unblocked.project_id,
      'taskId', unblocked.id
    )
  from unblocked
  cross join lateral unnest(unblocked.assignee_ids) as assignee(user_id)
  where assignee.user_id is not null;

  return new;
end;
$func$;

drop trigger if exists unblock_tasks_when_task_done on public.tasks;
create trigger unblock_tasks_when_task_done
  after update of status on public.tasks
  for each row
  when (old.status is distinct from new.status and new.status = 'done')
  execute function public.unblock_tasks_after_task_done();

drop trigger if exists unblock_tasks_when_project_done on public.projects;
create trigger unblock_tasks_when_project_done
  after update of status on public.projects
  for each row
  when (old.status is distinct from new.status and new.status = 'done')
  execute function public.unblock_tasks_after_project_done();
