-- When work on a task begins, for the projects timeline (/timeline).
--
-- A task with a start and a due date is drawn as a bar between them; one with
-- only a due date is a milestone on that day. Like due_date it is a plain
-- calendar date with no time zone, so every member sees the same day.
--
-- Nullable with no default: existing tasks keep showing as milestones on their
-- due date, and nothing has to be backfilled.
alter table public.tasks
  add column if not exists start_date date;
