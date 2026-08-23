// Supabase Edge Function: link-apple
//
// Stores the Apple refresh token for the calling user so `delete-account` can
// revoke it later, as App Store Review Guideline 5.1.1(v) requires.
//
// The native Sign in with Apple flow gives the app a one-time authorization
// code alongside the identity token. The code is only redeemable with the
// team's private key, which can never ship in a client bundle — so the client
// posts the code here and this function does the exchange.
//
// Whose token it is comes from the caller's own JWT, never from the body. The
// body carries only the code.
//
// Deploy with JWT verification ON (the default):
//   supabase functions deploy link-apple

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { exchangeAuthorizationCode, readAppleConfig } from '../_shared/apple.ts';

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
    const config = readAppleConfig();
    // Not configured is not an error the user should see: they are signed in
    // either way, and the only cost is that deletion cannot revoke the grant.
    if (!config) {
      console.warn('[link-apple] Apple secrets are not set — skipping');
      return json({ linked: false, reason: 'not-configured' }, 200);
    }

    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
    if (!token) return json({ error: 'Missing authorization' }, 401);

    const asCaller = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    const { data: caller, error: callerError } = await asCaller.auth.getUser(token);
    if (callerError || !caller?.user?.id) return json({ error: 'Invalid session' }, 401);

    const body = (await req.json().catch(() => null)) as { code?: unknown } | null;
    const code = typeof body?.code === 'string' ? body.code : '';
    if (!code) return json({ error: 'Missing authorization code' }, 400);

    const refreshToken = await exchangeAuthorizationCode(config, code);
    if (!refreshToken) return json({ linked: false, reason: 'exchange-failed' }, 200);

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    const { error } = await admin
      .from('apple_identity_tokens')
      .upsert(
        { user_id: caller.user.id, refresh_token: refreshToken, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
    if (error) throw error;

    return json({ linked: true }, 200);
  } catch (error) {
    console.error('[link-apple]', error);
    return json({ error: 'Could not link the Apple account' }, 500);
  }
});
