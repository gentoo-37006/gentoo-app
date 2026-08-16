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
// Deploy with JWT verification ON (the default) so unauthenticated callers
// never reach the handler:
//   supabase functions deploy delete-account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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
    const { error } = await admin.auth.admin.deleteUser(caller.user.id);
    if (error) throw error;

    return json({ deleted: true }, 200);
  } catch (error) {
    console.error('[delete-account]', error);
    return json({ error: 'Could not delete the account' }, 500);
  }
});
