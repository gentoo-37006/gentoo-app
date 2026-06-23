-- ============================================================================
-- 0004_match_scouting: match schedule, scouter assignments, and match reports
-- ============================================================================

create type public.assignment_status as enum ('assigned', 'submitted');

-- The match schedule (entered manually or imported from CSV) -----------------
create table public.matches (
  id             uuid primary key default gen_random_uuid(),
  match_number   int not null,
  label          text,
  scheduled_time timestamptz,
  red1 int, red2 int,
  blue1 int, blue2 int,
  created_at     timestamptz not null default now(),
  unique (match_number)
);
create index matches_number_idx on public.matches (match_number);

-- A scouter assigned to watch a match (optionally focused on one team) --------
create table public.scouting_assignments (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches (id) on delete cascade,
  scouter_id  uuid not null references public.profiles (id) on delete cascade,
  team_number int,
  status      public.assignment_status not null default 'assigned',
  assigned_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (match_id, scouter_id)
);
create index assignments_scouter_idx on public.scouting_assignments (scouter_id, status);
create index assignments_match_idx on public.scouting_assignments (match_id);

-- A submitted observation about a team's performance in a match --------------
create table public.match_reports (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid references public.scouting_assignments (id) on delete set null,
  match_id       uuid not null references public.matches (id) on delete cascade,
  scouter_id     uuid references public.profiles (id) on delete set null,
  team_number    int not null,
  rating         int,
  played_defense boolean not null default false,
  notes          text,
  created_at     timestamptz not null default now()
);
create index match_reports_match_idx on public.match_reports (match_id);

grant select, insert, update, delete on public.matches to authenticated;
grant select, insert, update, delete on public.scouting_assignments to authenticated;
grant select, insert, update, delete on public.match_reports to authenticated;

alter table public.matches enable row level security;
alter table public.scouting_assignments enable row level security;
alter table public.match_reports enable row level security;

-- matches: approved members manage; admins delete.
create policy "matches_select" on public.matches for select using (public.is_approved(auth.uid()));
create policy "matches_insert" on public.matches for insert with check (public.is_approved(auth.uid()));
create policy "matches_update" on public.matches for update using (public.is_approved(auth.uid()));
create policy "matches_delete" on public.matches for delete using (public.is_admin(auth.uid()));

-- assignments: approved read/create; the assigner or assignee can update/remove.
create policy "assignments_select" on public.scouting_assignments for select using (public.is_approved(auth.uid()));
create policy "assignments_insert" on public.scouting_assignments for insert with check (public.is_approved(auth.uid()));
create policy "assignments_update" on public.scouting_assignments for update
  using (scouter_id = auth.uid() or assigned_by = auth.uid() or public.is_admin(auth.uid()));
create policy "assignments_delete" on public.scouting_assignments for delete
  using (assigned_by = auth.uid() or public.is_admin(auth.uid()));

-- reports: approved read; scouter creates/edits own; admins delete.
create policy "reports_select" on public.match_reports for select using (public.is_approved(auth.uid()));
create policy "reports_insert" on public.match_reports for insert
  with check (public.is_approved(auth.uid()) and scouter_id = auth.uid());
create policy "reports_update_own" on public.match_reports for update using (scouter_id = auth.uid());
create policy "reports_delete" on public.match_reports for delete
  using (public.is_admin(auth.uid()) or scouter_id = auth.uid());
