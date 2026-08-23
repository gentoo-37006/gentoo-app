-- ============================================================================
-- 0029_apple_identity_tokens: Apple refresh tokens, for revocation on deletion
-- ============================================================================
--
-- App Store Review Guideline 5.1.1(v) requires an app offering Sign in with
-- Apple to call Apple's REST API and REVOKE the user's tokens when they delete
-- their account — deleting the Supabase auth user is not enough on its own.
--
-- Revoking needs an Apple refresh token, and the native identity-token flow
-- (see src/lib/apple-auth.ts) never yields one: Apple returns a one-time
-- authorization code instead, which the `link-apple` function exchanges. This
-- table is where the resulting refresh token waits until `delete-account` needs
-- it.
--
-- It holds a live credential, so it is service-role-only: RLS is on with NO
-- policies, and the `authenticated` grants that public.profiles hands out are
-- deliberately absent. A signed-in member must not be able to read even their
-- own row.

create table public.apple_identity_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text        not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.apple_identity_tokens enable row level security;

-- Belt and braces: no policies means no access under RLS, and no grants means
-- no access even if a policy is added carelessly later.
revoke all on public.apple_identity_tokens from anon, authenticated;

comment on table public.apple_identity_tokens is
  'Apple refresh tokens, used only to revoke Sign in with Apple on account deletion (App Store guideline 5.1.1(v)). Service role only.';
