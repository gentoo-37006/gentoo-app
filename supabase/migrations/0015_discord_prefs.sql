-- ============================================================================
-- 0015_discord_prefs: per-user Discord notification preferences
-- ============================================================================
--
-- Toggled from Discord via Kowalski's /notifications command and enforced by
-- the bot at delivery time. Missing keys mean "enabled" — {} keeps every
-- notification on. Known keys: "pings" (task-assignment pings), "digest"
-- (morning due-task digest).

alter table public.profiles
  add column discord_prefs jsonb not null default '{}'::jsonb;
