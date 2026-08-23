// Supabase Edge Function: delete-account
//
// App Store Review Guideline 5.1.1(v): an app that lets people create an
// account must let them delete it from inside the app. Deleting an auth user
// needs the service role, which can never ship in the client bundle, so the
// deletion happens here.
//
// The caller's own JWT decides whose account goes. The user id is NEVER read
// from the request body — that would turn this into "any signed-in member can
// delete any other member".
//
// Deleting the auth user is all that is required: public.profiles.id is
// `references auth.users (id) on delete cascade`, and everything hanging off a
// profile already declares its own intent — personal rows (push tokens, part
// checkouts, scouting assignments, Discord links) cascade away with it, while
// authorship on shared team records is `on delete set null` so a project or a
// pit-scouting entry survives the person who created it.
//
// Guideline 5.1.1(v) asks for one more thing when the app offers Sign in with
// Apple: the user's Apple tokens must be REVOKED through Apple's REST API, not
// merely orphaned. `link-apple` banked a refresh token for exactly this moment;
// see _shared/apple.ts. Revocation is best effort and deliberately cannot block
// the deletion — a user who asked to be deleted gets deleted either way.
//
// Deploy with JWT verification ON (the default) so unauthenticated callers
// never reach the handler:
//   supabase functions deploy delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { readAppleConfig, revokeRefreshToken } from '../_shared/apple.ts';

/**
 * Revoke this user's Sign in with Apple grant, if there is one to revoke.
 *
 * Runs BEFORE the auth user is deleted: apple_identity_tokens.user_id cascades
 * from auth.users, so after the delete there is nothing left to read.
 */
async function revokeAppleGrant(
  admin: ReturnType<typeof createClient>,
  userId: string
): Promise<void> {
  const config = readAppleConfig();
  if (!config) {
    console.warn('[delete-account] Apple secrets are not set — skipping revocation');
    return;
  }

  const { data, error } = await admin
    .from('apple_identity_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[delete-account] could not read the Apple token', error);
    return;
  }
  // No row means the account never signed in with Apple.
  if (!data?.refresh_token) return;

  const revoked = await revokeRefreshToken(config, data.refresh_token as string);
  console.log('[delete-account] Apple revocation', revoked ? 'succeeded' : 'failed');
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing authorization' }, 401);

    const url = Deno.env.get('SUPABASE_URL')!;

    // Resolve the caller from their own token. getUser(token) validates the
    // signature and expiry, so a forged or stale JWT stops here.
    const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!);
    const { data: caller, error: callerError } = await asCaller.auth.getUser(token);
    if (callerError || !caller?.user?.id) {
      return json({ error: 'Invalid session' }, 401);
    }

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    // Best effort, and before the delete — the token row cascades away with the
    // auth user. A throw in here must not cost the user their deletion.
    try {
      await revokeAppleGrant(admin, caller.user.id);
    } catch (revokeError) {
      console.error('[delete-account] Apple revocation errored', revokeError);
    }

    const { error } = await admin.auth.admin.deleteUser(caller.user.id);
    if (error) throw error;

    return json({ deleted: true }, 200);
  } catch (error) {
    console.error('[delete-account]', error);
    return json({ error: 'Could not delete the account' }, 500);
  }
});
