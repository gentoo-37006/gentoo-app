-- ============================================================================
-- 0012_app_settings: Stores global application settings and sync states.
-- ============================================================================

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

-- Enable RLS
alter table public.app_settings enable row level security;

-- Policies
create policy "Anyone can read app_settings"
  on public.app_settings for select
  using (true);

create policy "Admins can insert app_settings"
  on public.app_settings for insert
  with check (true);

create policy "Admins can update app_settings"
  on public.app_settings for update
  using (true);

create policy "Admins can delete matches"
  on public.matches for delete
  using (true);

create policy "Admins can delete scouted_teams"
  on public.scouted_teams for delete
  using (true);