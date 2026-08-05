-- Parts can be manually ordered in the inventory list.
alter table public.inventory_parts
  add column sort_order integer not null default 0;

-- Seed from the alphabetical order the list used before, so the first drag
-- starts from what people were already looking at.
with ordered as (
  select
    id,
    (row_number() over (order by lower(name), id) * 10)::integer as position
  from public.inventory_parts
)
update public.inventory_parts
set sort_order = ordered.position
from ordered
where public.inventory_parts.id = ordered.id;

create index inventory_parts_sort_idx
  on public.inventory_parts (sort_order, name);
