-- ============================================================================
-- 0002_notifications: in-app notifications + device push tokens
-- ============================================================================

create type public.notification_type as enum (
  'talkie_request',
  'talkie_claimed',
  'talkie_resolved',
  'match_report',
  'assignment',
  'approval',
  'task',
  'general'
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null default 'general',
  title      text not null,
  body       text,
  data       jsonb not null default '{}',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

grant select, insert, update, delete on public.notifications to authenticated;

alter table public.notifications enable row level security;

-- You can only read/update/delete your own notifications.
create policy "notifications_select_own"
  on public.notifications for select using (auth.uid() = user_id);

create policy "notifications_update_own"
  on public.notifications for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "notifications_delete_own"
  on public.notifications for delete using (auth.uid() = user_id);

-- Any approved member can create notifications for teammates (small trusted team).
create policy "notifications_insert_approved"
  on public.notifications for insert with check (public.is_approved(auth.uid()));

-- Live updates for the in-app bell.
alter publication supabase_realtime add table public.notifications;

-- Device push tokens (Expo). The send-push Edge Function reads these with the
-- service role; members only manage their own rows.
create table public.push_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null unique,
  platform   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index push_tokens_user_idx on public.push_tokens (user_id);

grant select, insert, update, delete on public.push_tokens to authenticated;

alter table public.push_tokens enable row level security;

create policy "push_tokens_manage_own"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
