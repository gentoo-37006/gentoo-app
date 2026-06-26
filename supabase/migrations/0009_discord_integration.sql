-- ============================================================================
-- 0009_discord_integration: Discord account linking
-- ============================================================================

-- Discord user ID (snowflake) stored on each profile
alter table public.profiles add column discord_id text unique;

-- Generates a 6-char uppercase hex token (3 random bytes → 6 hex chars)
create function public.generate_discord_token() returns text
  language sql
  as $$ select upper(substring(encode(gen_random_bytes(3), 'hex'), 1, 6)) $$;

-- One-time linking tokens: created in the app, consumed by the Discord bot
create table public.discord_link_tokens (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references public.profiles (id) on delete cascade,
  token      text        unique not null default public.generate_discord_token(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  used_at    timestamptz
);

create index discord_link_tokens_user_idx on public.discord_link_tokens (user_id);

grant select, insert, delete on public.discord_link_tokens to authenticated;

alter table public.discord_link_tokens enable row level security;

-- Users can only see and delete their own pending tokens.
-- The bot uses the service role key, which bypasses RLS entirely.
create policy "discord_tokens_select" on public.discord_link_tokens
  for select using (user_id = auth.uid());

create policy "discord_tokens_insert" on public.discord_link_tokens
  for insert with check (user_id = auth.uid());

create policy "discord_tokens_delete" on public.discord_link_tokens
  for delete using (user_id = auth.uid());
