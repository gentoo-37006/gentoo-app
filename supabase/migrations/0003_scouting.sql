-- ============================================================================
-- 0003_scouting: pit scouting — teams, capability questions, entries/answers,
-- and a weighted pick-list score view.
-- ============================================================================

create type public.answer_value as enum ('yes', 'no', 'did_not_see');

-- Teams we scout (also reused by match scouting / pick-list later) -----------
create table public.scouted_teams (
  id          uuid primary key default gen_random_uuid(),
  team_number int not null unique,
  team_name   text,
  notes       text,
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Admin-configurable pit-scouting questions ----------------------------------
create table public.capability_questions (
  id         uuid primary key default gen_random_uuid(),
  prompt     text not null,
  category   text not null default 'General',
  weight     numeric not null default 1,
  sort_order int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- One scouting visit by one scouter for one team -----------------------------
create table public.pit_scouting_entries (
  id              uuid primary key default gen_random_uuid(),
  scouted_team_id uuid not null references public.scouted_teams (id) on delete cascade,
  scouter_id      uuid references public.profiles (id) on delete set null,
  notes           text,
  created_at      timestamptz not null default now()
);
create index pit_entries_team_idx on public.pit_scouting_entries (scouted_team_id);

-- yes / no / did-not-see answers per question --------------------------------
create table public.pit_scouting_answers (
  id          uuid primary key default gen_random_uuid(),
  entry_id    uuid not null references public.pit_scouting_entries (id) on delete cascade,
  question_id uuid not null references public.capability_questions (id) on delete cascade,
  answer      public.answer_value not null
);
create index pit_answers_entry_idx on public.pit_scouting_answers (entry_id);
create index pit_answers_question_idx on public.pit_scouting_answers (question_id);

-- Weighted pick-list score per team. For each question: yes / (yes + no),
-- excluding "did not see"; combined as a weight-weighted average -> 0..100.
create or replace view public.team_scores as
select
  t.id          as team_id,
  t.team_number,
  t.team_name,
  coalesce((
    select round(100 * sum(q.weight * yf.yes_fraction) / nullif(sum(q.weight), 0))
    from (
      select
        a.question_id,
        count(*) filter (where a.answer = 'yes')::numeric
          / nullif(count(*) filter (where a.answer in ('yes', 'no')), 0) as yes_fraction
      from public.pit_scouting_answers a
      join public.pit_scouting_entries e on e.id = a.entry_id
      where e.scouted_team_id = t.id
      group by a.question_id
      having count(*) filter (where a.answer in ('yes', 'no')) > 0
    ) yf
    join public.capability_questions q on q.id = yf.question_id
  ), 0) as score,
  (select count(*) from public.pit_scouting_entries e where e.scouted_team_id = t.id) as entry_count
from public.scouted_teams t;

alter view public.team_scores set (security_invoker = on);

-- Grants ---------------------------------------------------------------------
grant select, insert, update, delete on public.scouted_teams to authenticated;
grant select, insert, update, delete on public.capability_questions to authenticated;
grant select, insert, update, delete on public.pit_scouting_entries to authenticated;
grant select, insert, update, delete on public.pit_scouting_answers to authenticated;
grant select on public.team_scores to authenticated;

-- RLS ------------------------------------------------------------------------
alter table public.scouted_teams enable row level security;
alter table public.capability_questions enable row level security;
alter table public.pit_scouting_entries enable row level security;
alter table public.pit_scouting_answers enable row level security;

-- scouted_teams: approved members read/add/edit; only admins delete.
create policy "teams_select" on public.scouted_teams for select using (public.is_approved(auth.uid()));
create policy "teams_insert" on public.scouted_teams for insert with check (public.is_approved(auth.uid()));
create policy "teams_update" on public.scouted_teams for update using (public.is_approved(auth.uid()));
create policy "teams_delete" on public.scouted_teams for delete using (public.is_admin(auth.uid()));

-- capability_questions: approved read; admins write.
create policy "questions_select" on public.capability_questions for select using (public.is_approved(auth.uid()));
create policy "questions_admin_write" on public.capability_questions for all
  using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));

-- entries: approved read/add; scouter edits own; admins delete.
create policy "entries_select" on public.pit_scouting_entries for select using (public.is_approved(auth.uid()));
create policy "entries_insert" on public.pit_scouting_entries for insert
  with check (public.is_approved(auth.uid()) and scouter_id = auth.uid());
create policy "entries_update_own" on public.pit_scouting_entries for update using (scouter_id = auth.uid());
create policy "entries_delete" on public.pit_scouting_entries for delete
  using (public.is_admin(auth.uid()) or scouter_id = auth.uid());

-- answers: approved read/add; deletes cascade with the entry / admins.
create policy "answers_select" on public.pit_scouting_answers for select using (public.is_approved(auth.uid()));
create policy "answers_insert" on public.pit_scouting_answers for insert with check (public.is_approved(auth.uid()));
create policy "answers_delete" on public.pit_scouting_answers for delete using (public.is_admin(auth.uid()));

-- Seed a sensible default question set ----------------------------------------
insert into public.capability_questions (prompt, category, weight, sort_order) values
  ('Has a working autonomous routine?',        'Autonomous', 2, 10),
  ('Scores game pieces during autonomous?',    'Autonomous', 2, 20),
  ('Leaves the starting zone in autonomous?',  'Autonomous', 1, 30),
  ('Scores reliably during tele-op?',          'Tele-Op',    3, 40),
  ('Can play effective defense?',              'Tele-Op',    1, 50),
  ('Completes an endgame (climb/park)?',       'Endgame',    2, 60),
  ('Has a robust, reliable drivetrain?',       'Robot',      2, 70),
  ('Well-built with few mechanical issues?',   'Robot',      1, 80);
