-- ============================================================================
-- 0021_team_official_stats: keep the official FTC Scout standings we already
-- fetch, so scouted impressions can be read next to real results.
-- ============================================================================
--
-- The FTC Scout sync pulls each team's event stats (rank, win-loss-tie record,
-- average score) along with the roster, then dropped everything but the team
-- number and name. Storing them lets the pit list and team page show how a
-- team is actually doing at the event, not just what our scouters saw.
--
-- Every column is nullable: teams entered by hand, and teams whose first match
-- hasn't been played, have no official standing yet.

alter table public.scouted_teams
  add column official_rank       int,
  add column official_wins       int,
  add column official_losses     int,
  add column official_ties       int,
  add column official_avg_points numeric,
  add column stats_synced_at     timestamptz;

-- The pit list reads team_scores, so the standings have to travel with it.
-- create-or-replace can only append columns, so these go after event_code.
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
  t.event_code,
  t.official_rank,
  t.official_wins,
  t.official_losses,
  t.official_ties,
  t.official_avg_points
from public.scouted_teams t;

alter view public.team_scores set (security_invoker = on);
