-- ============================================================================
-- 0025_inventory: shop parts inventory with sign-out / usage tracking
-- ============================================================================

create type public.part_category as enum (
  'motor',
  'servo',
  'electronics',
  'wiring',
  'structure',
  'motion',
  'hardware',
  'material',
  'tool',
  'other'
);

create table public.inventory_parts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  part_number  text,
  category     public.part_category not null default 'other',
  location     text,
  notes        text,
  -- Units owned (durable parts) or units still in stock (consumables).
  quantity     integer not null default 0 check (quantity >= 0),
  -- Consumables are used up instead of returned; see the stock trigger below.
  consumable   boolean not null default false,
  unit         text,
  -- Warn at or below this quantity; null disables the warning.
  low_stock_at integer check (low_stock_at is null or low_stock_at >= 0),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index inventory_parts_name_idx on public.inventory_parts (lower(name));

-- One row per sign-out (durable) or usage (consumable) event.
create table public.inventory_checkouts (
  id             uuid primary key default gen_random_uuid(),
  part_id        uuid not null references public.inventory_parts (id) on delete cascade,
  user_id        uuid references public.profiles (id) on delete set null,
  quantity       integer not null check (quantity > 0),
  consumed       boolean not null default false,
  purpose        text,
  checked_out_at timestamptz not null default now(),
  returned_at    timestamptz,
  returned_by    uuid references public.profiles (id) on delete set null,
  -- Used-up stock never comes back, so a consumed row can't be returned.
  constraint inventory_checkouts_consumed_not_returned
    check (not (consumed and returned_at is not null))
);
create index inventory_checkouts_part_idx on public.inventory_checkouts (part_id);
create index inventory_checkouts_open_idx
  on public.inventory_checkouts (part_id)
  where returned_at is null and not consumed;

-- Durable parts keep their quantity while out on loan (availability is derived
-- from the open rows), but consuming stock has to deduct from it. Doing that in
-- a trigger keeps the deduction atomic with the log row it came from.
create or replace function public.apply_consumed_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $func$
begin
  if tg_op = 'INSERT' and new.consumed then
    update public.inventory_parts
    set quantity = greatest(0, quantity - new.quantity), updated_at = now()
    where id = new.part_id;
  elsif tg_op = 'DELETE' and old.consumed then
    update public.inventory_parts
    set quantity = quantity + old.quantity, updated_at = now()
    where id = old.part_id;
  end if;
  return null;
end;
$func$;

create trigger inventory_checkouts_apply_stock
after insert or delete on public.inventory_checkouts
for each row execute function public.apply_consumed_stock();

grant select, insert, update, delete on public.inventory_parts to authenticated;
grant select, insert, update, delete on public.inventory_checkouts to authenticated;

alter table public.inventory_parts enable row level security;
alter table public.inventory_checkouts enable row level security;

-- The whole team shares one parts bin: approved members read and maintain it,
-- and deleting a part is limited to admins or whoever added it.
create policy "inventory_parts_select" on public.inventory_parts for select
  using (public.is_approved(auth.uid()));
create policy "inventory_parts_insert" on public.inventory_parts for insert
  with check (public.is_approved(auth.uid()));
create policy "inventory_parts_update" on public.inventory_parts for update
  using (public.is_approved(auth.uid()));
create policy "inventory_parts_delete" on public.inventory_parts for delete
  using (public.is_admin(auth.uid()) or created_by = auth.uid());

-- Anyone can sign a part back in — parts get handed off mid-build and the
-- person returning it is often not the one who took it.
create policy "inventory_checkouts_select" on public.inventory_checkouts for select
  using (public.is_approved(auth.uid()));
create policy "inventory_checkouts_insert" on public.inventory_checkouts for insert
  with check (public.is_approved(auth.uid()));
create policy "inventory_checkouts_update" on public.inventory_checkouts for update
  using (public.is_approved(auth.uid()));
create policy "inventory_checkouts_delete" on public.inventory_checkouts for delete
  using (public.is_admin(auth.uid()) or user_id = auth.uid());

alter publication supabase_realtime add table public.inventory_parts;
alter publication supabase_realtime add table public.inventory_checkouts;
