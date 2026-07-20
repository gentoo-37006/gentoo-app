-- ============================================================================
-- 0012_discord_task_pings: track Discord delivery of task notifications
-- ============================================================================
--
-- The Kowalski Discord bot polls public.notifications for task rows it hasn't
-- delivered yet (discord_sent_at is null), @mentions the assignee's linked
-- Discord account, and stamps discord_sent_at. The claim is a conditional
-- update, so concurrent bot instances never double-ping.

alter table public.notifications add column discord_sent_at timestamptz;

-- Backfill so the bot's first run doesn't replay historical notifications.
update public.notifications set discord_sent_at = created_at;

create index notifications_discord_pending_idx
  on public.notifications (created_at)
  where discord_sent_at is null and type = 'task';
