-- ============================================================================
-- 0006_picklist: pick-list tiering + a per-capability score view for filtering
-- ============================================================================

alter table public.scouted_teams
  add column picklist_tier  text check (picklist_tier in ('tier1', 'tier2', 'tier3', 'dnp')),
  add column picklist_rank  int,
  add column picklist_notes text;

-- Per-team, per-question yes-percentage (excludes "did not see"). Used to
-- filter the pick-list by specific capabilities.
create or replace view public.team_capability_scores as
select
  e.scouted_team_id as team_id,
  a.question_id,
  round(
    100 * count(*) filter (where a.answer = 'yes')::numeric
      / nullif(count(*) filter (where a.answer in ('yes', 'no')), 0)
  ) as percent
from public.pit_scouting_answers a
join public.pit_scouting_entries e on e.id = a.entry_id
group by e.scouted_team_id, a.question_id
having count(*) filter (where a.answer in ('yes', 'no')) > 0;

alter view public.team_capability_scores set (security_invoker = on);
grant select on public.team_capability_scores to authenticated;
