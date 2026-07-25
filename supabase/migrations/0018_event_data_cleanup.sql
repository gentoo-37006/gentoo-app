-- ============================================================================
-- 0018_event_data_cleanup: fold the event_data payload back into the tables it
-- duplicated (matches, scouted_teams) and keep what's left as app settings.
-- ============================================================================
--
-- 0012 started writing the whole FTC Scout sync into event_data as JSON, so the
-- schedule and the team roster existed twice: once relationally and once in a
-- blob. Every read merged the two, and matches that only existed in the blob
-- got fake ids that couldn't be assigned to. The columns that only the blob had
-- are added here, the blob is backfilled into them and dropped, and event_data
-- becomes the single-row settings table it always was in practice.

-- Columns that previously only lived in event_data.data.matches --------------
alter table public.matches
  add column event_code       text    not null default '',
  add column tournament_level text,
  add column has_been_played  boolean not null default false,
  add column red_score  int,
  add column red_auto   int,
  add column red_dc     int,
  add column blue_score int,
  add column blue_auto  int,
  add column blue_dc    int;

-- Teams keep one row across events so their pit history follows them; the event
-- code only records which event's roster they were last synced with.
alter table public.scouted_teams add column event_code text not null default '';

-- Backfill both tables from the blob before it goes away ---------------------
with payload as (
  select
    e.event_code as code,
    case when jsonb_typeof(e.data -> 'matches') = 'array' then e.data -> 'matches' else '[]'::jsonb end as matches
  from public.event_data e
  where e.event_code = (select data ->> 'eventCode' from public.event_data where event_code = 'active_event')
),
synced_matches as (
  select p.code, j from payload p, lateral jsonb_array_elements(p.matches) j
)
update public.matches m set
  event_code       = s.code,
  tournament_level = s.j ->> 'tournament_level',
  has_been_played  = coalesce((s.j ->> 'has_been_played')::boolean, false),
  red_score  = (s.j ->> 'red_score')::int,
  red_auto   = (s.j ->> 'red_auto')::int,
  red_dc     = (s.j ->> 'red_dc')::int,
  blue_score = (s.j ->> 'blue_score')::int,
  blue_auto  = (s.j ->> 'blue_auto')::int,
  blue_dc    = (s.j ->> 'blue_dc')::int
from synced_matches s
where m.match_number = (s.j ->> 'match_number')::int;

with payload as (
  select
    e.event_code as code,
    case when jsonb_typeof(e.data -> 'teams') = 'array' then e.data -> 'teams' else '[]'::jsonb end as teams
  from public.event_data e
  where e.event_code = (select data ->> 'eventCode' from public.event_data where event_code = 'active_event')
),
synced_teams as (
  select p.code, j from payload p, lateral jsonb_array_elements(p.teams) j
)
update public.scouted_teams t set
  event_code = s.code,
  team_name  = coalesce(t.team_name, s.j ->> 'team_name')
from synced_teams s
where t.team_number = (s.j ->> 'team_number')::int;

-- Match numbers repeat between events, so the schedule is keyed per event.
alter table public.matches drop constraint matches_match_number_key;
alter table public.matches add constraint matches_event_match_key unique (event_code, match_number);

-- The roster is filtered by event, so the view has to expose the event code.
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
  (select count(*) from public.pit_scouting_entries e where e.scouted_team_id = t.id) as entry_count,
  t.event_code
from public.scouted_teams t;

alter view public.team_scores set (security_invoker = on);

-- event_data -> app_settings --------------------------------------------------
delete from public.event_data where event_code <> 'active_event';

alter table public.event_data rename to app_settings;
alter table public.app_settings rename column event_code to key;
alter table public.app_settings rename column data to value;
alter table public.app_settings drop column updated_by;

drop policy if exists "Anyone can read event_data" on public.app_settings;
drop policy if exists "Admins can insert event_data" on public.app_settings;
drop policy if exists "Admins can update event_data" on public.app_settings;

create policy "app_settings_all" on public.app_settings for all
  using (public.is_approved(auth.uid())) with check (public.is_approved(auth.uid()));

grant select, insert, update, delete on public.app_settings to authenticated;

-- 0012 also re-declared these two deletes with `using (true)`, which let any
-- signed-in user delete matches and teams. 0003/0004 already cover admins.
drop policy if exists "Admins can delete matches" on public.matches;
drop policy if exists "Admins can delete scouted_teams" on public.scouted_teams;
