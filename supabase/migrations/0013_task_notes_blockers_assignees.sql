-- ============================================================================
-- 0013_task_notes_blockers_assignees: markdown notes, blockers, co-assignees
-- ============================================================================

-- Full-page markdown body for a task.
alter table public.tasks add column notes text;

-- The task this one is waiting on; only meaningful while status = 'blocked'.
-- Completing the blocker deletes it, which clears the reference.
alter table public.tasks add column blocked_by uuid references public.tasks (id) on delete set null;

-- Tasks can now have several assignees. Stored as an id array (like tags) so
-- reads stay single-statement; drops the old single-assignee column.
alter table public.tasks add column assignee_ids uuid[] not null default '{}';
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null;
alter table public.tasks drop column assignee_id;
create index tasks_assignees_idx on public.tasks using gin (assignee_ids);

-- Marking a task done now deletes it, so no row should sit in the 'done' state.
delete from public.tasks where status = 'done';
