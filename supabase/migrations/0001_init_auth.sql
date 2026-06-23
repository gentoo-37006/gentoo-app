-- ============================================================================
-- 0001_init_auth: profiles, first-user-is-admin onboarding, and approval gating
-- ============================================================================

-- Roles & status -------------------------------------------------------------
create type public.user_role as enum ('admin', 'member');
create type public.user_status as enum ('pending', 'approved', 'rejected');

-- Profiles -------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  full_name        text,
  email            text,
  avatar_url       text,
  role             public.user_role   not null default 'member',
  functional_roles text[]             not null default '{}',
  status           public.user_status not null default 'pending',
  created_at       timestamptz        not null default now(),
  updated_at       timestamptz        not null default now()
);

grant select, insert, update, delete on public.profiles to authenticated;

-- Helper predicates (security definer so they bypass RLS and avoid recursion) -
create or replace function public.is_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and role = 'admin');
$$;

create or replace function public.is_approved(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = uid and status = 'approved');
$$;

-- New user onboarding: first ever account becomes an approved admin, the rest
-- start as pending members awaiting approval. Google metadata fills the profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  admin_exists boolean;
begin
  select exists (select 1 from public.profiles where role = 'admin') into admin_exists;

  insert into public.profiles (id, full_name, email, avatar_url, role, status)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    (case when admin_exists then 'member' else 'admin' end)::public.user_role,
    (case when admin_exists then 'pending' else 'approved' end)::public.user_status
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent privilege escalation: only admins may change role/status; everyone
-- else's attempts are reverted. Also stamps updated_at on every change.
create or replace function public.protect_profile_privileges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin(auth.uid()) then
    new.role := old.role;
    new.status := old.status;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_profile_privileges
  before update on public.profiles
  for each row execute function public.protect_profile_privileges();

-- Row level security ---------------------------------------------------------
alter table public.profiles enable row level security;

-- Read your own profile (even while pending).
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

-- Approved members can read the whole roster (assignees, members list, etc.).
create policy "profiles_select_approved"
  on public.profiles for select
  using (public.is_approved(auth.uid()));

-- Update your own profile (role/status changes are stripped by the trigger).
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Admins can update anyone (approvals, roles).
create policy "profiles_update_admin"
  on public.profiles for update
  using (public.is_admin(auth.uid()));
