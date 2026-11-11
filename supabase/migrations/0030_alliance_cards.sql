-- ============================================================================
-- 0030_alliance_cards: scouting cards — a one-day public page about our robot
-- that we hand to an alliance partner (gentoo.ethanyanxu.com/allianceinfo/16417).
-- ============================================================================
--
-- One card per partner team, keyed by their team number so the link can be read
-- out loud in the pit. The partner has no account, so the page reads the card
-- through get_alliance_card() as `anon`; the table itself stays behind approval
-- like everything else. The form the cards are filled in from is one row of
-- app_settings ('alliance_card_template'), which already has the right policy.

create table public.alliance_cards (
  partner_team int primary key check (partner_team between 1 and 99999),
  partner_name text,
  -- [{ id, label, kind, value }] — a snapshot of the form as it was sent.
  fields       jsonb not null default '[]'::jsonb
               check (jsonb_typeof(fields) = 'array' and octet_length(fields::text) <= 40000),
  -- { field, paths: [{ name, curves }] } in field inches, or null for no paths.
  auton        jsonb
               check (auton is null or (jsonb_typeof(auton) = 'object' and octet_length(auton::text) <= 200000)),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '1 day')
);

-- Expiry ---------------------------------------------------------------------
-- A card lives for one day after it was last saved. The clock is set here, not
-- by the client, so no request can ask for a longer life.
create or replace function public.stamp_alliance_card()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();
  new.expires_at := now() + interval '1 day';
  return new;
end;
$$;

create trigger stamp_alliance_card
  before insert or update on public.alliance_cards
  for each row execute function public.stamp_alliance_card();

-- Deleting, not just hiding: an expired card is gone the next time anyone
-- writes a card, opens the cards screen or opens any card link — and every
-- 15 minutes regardless when pg_cron is enabled (see the end of this file).
create or replace function public.purge_expired_alliance_cards()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.alliance_cards where expires_at <= now();
$$;

-- Runs before the rows of an insert are looked at, so re-sending a card to a
-- partner whose old card has expired inserts a fresh row instead of colliding
-- with one the policies below would refuse to update.
create or replace function public.purge_expired_alliance_cards_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.alliance_cards where expires_at <= now();
  return null;
end;
$$;

create trigger purge_expired_alliance_cards
  before insert on public.alliance_cards
  for each statement execute function public.purge_expired_alliance_cards_trigger();

-- Grants & RLS ---------------------------------------------------------------
-- Supabase hands new tables and functions to `anon` by default. RLS already
-- shuts anon out of the table; take the grants away as well, so that
-- get_alliance_card() below is the only door a visitor without an account has.
revoke all on public.alliance_cards from anon;
grant select, insert, update, delete on public.alliance_cards to authenticated;
revoke all on function public.purge_expired_alliance_cards() from public, anon;
grant execute on function public.purge_expired_alliance_cards() to authenticated;

alter table public.alliance_cards enable row level security;

-- Approved members manage cards. An expired card is invisible even in the
-- moments before it is deleted.
create policy "alliance_cards_select" on public.alliance_cards for select
  using (public.is_approved(auth.uid()) and expires_at > now());
create policy "alliance_cards_insert" on public.alliance_cards for insert
  with check (public.is_approved(auth.uid()));
create policy "alliance_cards_update" on public.alliance_cards for update
  using (public.is_approved(auth.uid()) and expires_at > now())
  with check (public.is_approved(auth.uid()));
create policy "alliance_cards_delete" on public.alliance_cards for delete
  using (public.is_approved(auth.uid()));

-- The partner's read -----------------------------------------------------------
-- The only thing `anon` can do: fetch one live card by team number. There is no
-- way to list cards, so knowing one partner's link reveals nothing about another.
-- Returns null when there is no live card, which the page shows as "expired".
create or replace function public.get_alliance_card(team_number int)
returns jsonb
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  card jsonb;
begin
  delete from public.alliance_cards where expires_at <= now();

  select jsonb_build_object(
    'partner_team', c.partner_team,
    'partner_name', c.partner_name,
    'fields',       c.fields,
    'auton',        c.auton,
    'updated_at',   c.updated_at,
    'expires_at',   c.expires_at
  )
  into card
  from public.alliance_cards c
  where c.partner_team = team_number;

  return card;
end;
$$;

revoke all on function public.get_alliance_card(int) from public;
grant execute on function public.get_alliance_card(int) to anon, authenticated;

-- Realtime, so the cards screen follows a teammate's edit ---------------------
alter publication supabase_realtime add table public.alliance_cards;

-- Scheduled cleanup, where pg_cron is available --------------------------------
-- Optional on purpose: the migration must also apply on a project without the
-- extension, and the purges above already keep expired cards unreachable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule(
      'purge-expired-alliance-cards',
      '*/15 * * * *',
      'select public.purge_expired_alliance_cards()'
    );
  end if;
end
$$;
