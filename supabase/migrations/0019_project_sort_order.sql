-- Projects can be manually ordered in the projects list.
alter table public.projects
  add column sort_order integer not null default 0;

with ordered as (
  select
    id,
    (row_number() over (order by created_at, id) * 10)::integer as position
  from public.projects
)
update public.projects
set sort_order = ordered.position
from ordered
where public.projects.id = ordered.id;

create index projects_sort_idx
  on public.projects (sort_order, created_at);
