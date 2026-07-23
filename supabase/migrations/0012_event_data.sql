-- ============================================================================
-- 0012_event_data: Stores entire event sync JSON data.
-- ============================================================================

create table public.event_data (
  event_code text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Enable RLS
alter table public.event_data enable row level security;

-- Policies
create policy "Anyone can read event_data"
  on public.event_data for select
  using (true);

create policy "Admins can insert event_data"
  on public.event_data for insert
  with check (true);

create policy "Admins can update event_data"
  on public.event_data for update
  using (true);

create policy "Admins can delete matches"
  on public.matches for delete
  using (true);

create policy "Admins can delete scouted_teams"
  on public.scouted_teams for delete
  using (true);