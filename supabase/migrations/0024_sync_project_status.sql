-- ============================================================================
-- 0024_sync_project_status: derive project workflow state from its tasks
-- ============================================================================

create or replace function public.recalculate_project_status(
  target_project_id uuid,
  force_in_progress boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $func$
declare
  current_status public.project_status;
  next_status public.project_status;
  task_count integer;
  unfinished_count integer;
  blocked_count integer;
  in_progress_count integer;
begin
  select status
  into current_status
  from public.projects
  where id = target_project_id
    and deleted_at is null
  for update;

  if not found then
    return;
  end if;

  select
    count(*)::integer,
    count(*) filter (where status <> 'done')::integer,
    count(*) filter (where status = 'blocked')::integer,
    count(*) filter (where status = 'in_progress')::integer
  into task_count, unfinished_count, blocked_count, in_progress_count
  from public.tasks
  where project_id = target_project_id
    and deleted_at is null;

  -- An empty project keeps its current status. In particular, it is not
  -- vacuously complete and this function never assigns Planning.
  if task_count = 0 then
    return;
  end if;

  if unfinished_count = 0 then
    next_status := 'done';
  elsif force_in_progress and current_status in ('done', 'on_hold') then
    next_status := 'active';
  elsif blocked_count = unfinished_count then
    next_status := 'on_hold';
  elsif current_status in ('done', 'on_hold') then
    next_status := 'active';
  elsif current_status = 'planning' and in_progress_count > 0 then
    next_status := 'active';
  else
    return;
  end if;

  if next_status is distinct from current_status then
    update public.projects
    set status = next_status,
        updated_at = now()
    where id = target_project_id;
  end if;
end;
$func$;

revoke all on function public.recalculate_project_status(uuid, boolean) from public;

create or replace function public.sync_project_status_after_task_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
declare
  target_project_id uuid;
  force_in_progress boolean := false;
begin
  if tg_op = 'DELETE' then
    target_project_id := old.project_id;
  else
    target_project_id := new.project_id;
  end if;

  if tg_op = 'INSERT' then
    force_in_progress := true;
  elsif tg_op = 'UPDATE' then
    force_in_progress :=
      old.status = 'blocked'
      and new.status in ('todo', 'in_progress');
  end if;

  perform public.recalculate_project_status(target_project_id, force_in_progress);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$func$;

create or replace function public.enforce_project_status_after_manual_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if new.status = 'planning' then
    perform public.recalculate_project_status(new.id, false);
  end if;
  return new;
end;
$func$;

drop trigger if exists sync_project_status_after_task_insert on public.tasks;
create trigger sync_project_status_after_task_insert
  after insert on public.tasks
  for each row
  execute function public.sync_project_status_after_task_change();

drop trigger if exists sync_project_status_after_task_update on public.tasks;
create trigger sync_project_status_after_task_update
  after update of status, deleted_at on public.tasks
  for each row
  when (
    old.status is distinct from new.status
    or old.deleted_at is distinct from new.deleted_at
  )
  execute function public.sync_project_status_after_task_change();

drop trigger if exists sync_project_status_after_task_delete on public.tasks;
create trigger sync_project_status_after_task_delete
  after delete on public.tasks
  for each row
  execute function public.sync_project_status_after_task_change();

drop trigger if exists enforce_project_status_after_manual_change on public.projects;
create trigger enforce_project_status_after_manual_change
  after update of status on public.projects
  for each row
  when (old.status is distinct from new.status and new.status = 'planning')
  execute function public.enforce_project_status_after_manual_change();

-- Bring existing projects into the same state immediately.
do $block$
declare
  project_record record;
begin
  for project_record in
    select id from public.projects where deleted_at is null
  loop
    perform public.recalculate_project_status(project_record.id, false);
  end loop;
end;
$block$;
