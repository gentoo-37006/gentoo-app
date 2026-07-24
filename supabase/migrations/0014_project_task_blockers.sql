-- Tasks may wait on either one task or one project.
alter table public.tasks
  add column blocked_by_project uuid references public.projects (id) on delete set null;

alter table public.tasks
  add constraint tasks_single_blocker
  check (blocked_by is null or blocked_by_project is null);
