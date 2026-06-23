-- ============================================================================
-- 0007_tasks: projects and their tasks
-- ============================================================================

create type public.project_status as enum ('planning', 'active', 'on_hold', 'done');
create type public.task_status    as enum ('todo', 'in_progress', 'blocked', 'done');
create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');

create table public.projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  status      public.project_status not null default 'planning',
  priority    public.priority_level not null default 'medium',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.tasks (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references public.projects (id) on delete cascade,
  title       text not null,
  status      public.task_status not null default 'todo',
  assignee_id uuid references public.profiles (id) on delete set null,
  due_date    date,
  priority    public.priority_level not null default 'medium',
  tags        text[] not null default '{}',
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index tasks_project_idx on public.tasks (project_id);
create index tasks_assignee_idx on public.tasks (assignee_id);

grant select, insert, update, delete on public.projects to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;

alter table public.projects enable row level security;
alter table public.tasks enable row level security;

-- Approved members collaborate on projects/tasks; admins or creators can delete.
create policy "projects_select" on public.projects for select using (public.is_approved(auth.uid()));
create policy "projects_insert" on public.projects for insert with check (public.is_approved(auth.uid()));
create policy "projects_update" on public.projects for update using (public.is_approved(auth.uid()));
create policy "projects_delete" on public.projects for delete
  using (public.is_admin(auth.uid()) or created_by = auth.uid());

create policy "tasks_select" on public.tasks for select using (public.is_approved(auth.uid()));
create policy "tasks_insert" on public.tasks for insert with check (public.is_approved(auth.uid()));
create policy "tasks_update" on public.tasks for update using (public.is_approved(auth.uid()));
create policy "tasks_delete" on public.tasks for delete
  using (public.is_admin(auth.uid()) or created_by = auth.uid());
