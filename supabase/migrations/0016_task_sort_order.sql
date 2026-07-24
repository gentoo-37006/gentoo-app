-- Tasks can be manually ordered within each project.
alter table public.tasks
  add column sort_order integer not null default 0;

with ordered as (
  select
    id,
    (row_number() over (partition by project_id order by created_at, id) * 10)::integer as position
  from public.tasks
)
update public.tasks
set sort_order = ordered.position
from ordered
where public.tasks.id = ordered.id;

create index tasks_project_sort_idx
  on public.tasks (project_id, sort_order, created_at);
