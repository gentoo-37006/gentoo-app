-- Enable Postgres Changes for every table that backs live application data.
-- Views such as team_scores and team_capability_scores are refreshed through
-- subscriptions to their underlying scouting tables.
do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'profiles',
    'notifications',
    'scouted_teams',
    'capability_questions',
    'pit_scouting_entries',
    'pit_scouting_answers',
    'matches',
    'scouting_assignments',
    'match_reports',
    'talkie_requests',
    'projects',
    'tasks',
    'pit_shifts',
    'app_settings'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = table_name
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        table_name
      );
    end if;
  end loop;
end
$$;
