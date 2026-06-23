-- ============================================================================
-- 0005_talkie: live "go ask a team in the pits" requests
-- ============================================================================

create type public.talkie_status as enum ('open', 'claimed', 'resolved');

create table public.talkie_requests (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid references public.profiles (id) on delete set null,
  team_number  int not null,
  reason       text not null,
  status       public.talkie_status not null default 'open',
  claimed_by   uuid references public.profiles (id) on delete set null,
  claimed_at   timestamptz,
  response     text,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index talkie_status_idx on public.talkie_requests (status, created_at desc);

grant select, insert, update, delete on public.talkie_requests to authenticated;

alter table public.talkie_requests enable row level security;

-- Approved members see all requests, raise their own, and can claim/resolve any.
create policy "talkie_select" on public.talkie_requests for select using (public.is_approved(auth.uid()));
create policy "talkie_insert" on public.talkie_requests for insert
  with check (public.is_approved(auth.uid()) and requester_id = auth.uid());
create policy "talkie_update" on public.talkie_requests for update using (public.is_approved(auth.uid()));
create policy "talkie_delete" on public.talkie_requests for delete
  using (public.is_admin(auth.uid()) or requester_id = auth.uid());

-- Live updates for the talkie board.
alter publication supabase_realtime add table public.talkie_requests;
