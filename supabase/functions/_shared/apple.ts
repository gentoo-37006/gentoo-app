// Apple ID REST API helpers, shared by `link-apple` and `delete-account`.
//
// App Store Review Guideline 5.1.1(v): an app that offers Sign in with Apple
// must revoke the user's tokens through Apple's REST API when the account is
// deleted. Both halves of that — obtaining a refresh token, then revoking it —
// authenticate with a short-lived ES256 JWT signed by the team's private key,
// which is what this module builds.
//
// Required secrets (Supabase -> Edge Functions -> Secrets):
//   APPLE_CLIENT_ID    the app's bundle id, com.gentoo.app
//   APPLE_TEAM_ID      10-character Apple Developer team id
//   APPLE_KEY_ID       key id of the "Sign in with Apple" key
//   APPLE_PRIVATE_KEY  contents of the .p8 file, including the BEGIN/END lines
//
// With any of them unset every function here reports "not configured" and the
// callers skip Apple entirely — account deletion must never fail because token
// revocation could not run.

import { SignJWT, importPKCS8 } from 'https://esm.sh/jose@5.9.6';

const APPLE_ISSUER = 'https://appleid.apple.com';

/** Apple rejects anything over 6 months; short is fine, these are single-use. */
const CLIENT_SECRET_TTL_SECONDS = 300;

export type AppleConfig = {
  clientId: string;
  teamId: string;
  keyId: string;
  privateKey: string;
};

export function readAppleConfig(): AppleConfig | null {
  const clientId = Deno.env.get('APPLE_CLIENT_ID');
  const teamId = Deno.env.get('APPLE_TEAM_ID');
  const keyId = Deno.env.get('APPLE_KEY_ID');
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY');

  if (!clientId || !teamId || !keyId || !privateKey) return null;

  return {
    clientId,
    teamId,
    keyId,
    // Secrets set through the dashboard or the CLI routinely arrive with the
    // newlines escaped; importPKCS8 needs them real.
    privateKey: privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey,
  };
}

/** The `client_secret` Apple expects: a JWT signed with the team's .p8 key. */
async function buildClientSecret(config: AppleConfig): Promise<string> {
  const key = await importPKCS8(config.privateKey, 'ES256');
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .setExpirationTime(now + CLIENT_SECRET_TTL_SECONDS)
    .setAudience(APPLE_ISSUER)
    .setSubject(config.clientId)
    .sign(key);
}

async function postForm(path: string, params: Record<string, string>): Promise<Response> {
  return await fetch(`${APPLE_ISSUER}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
}

/**
 * Trade the one-time authorization code from `AppleAuthentication.signInAsync`
 * for a refresh token. Returns null on any failure — the caller treats a missing
 * refresh token as "nothing to revoke later", never as a failed sign-in.
 */
export async function exchangeAuthorizationCode(
  config: AppleConfig,
  code: string
): Promise<string | null> {
  const res = await postForm('/auth/token', {
    client_id: config.clientId,
    client_secret: await buildClientSecret(config),
    code,
    grant_type: 'authorization_code',
  });

  if (!res.ok) {
    console.error('[apple] code exchange failed', res.status, await res.text());
    return null;
  }

  const payload = (await res.json()) as { refresh_token?: string };
  return payload.refresh_token ?? null;
}

/** Revoke a refresh token, taking the user's Apple grant for this app with it. */
export async function revokeRefreshToken(
  config: AppleConfig,
  refreshToken: string
): Promise<boolean> {
  const res = await postForm('/auth/revoke', {
    client_id: config.clientId,
    client_secret: await buildClientSecret(config),
    token: refreshToken,
    token_type_hint: 'refresh_token',
  });

  if (!res.ok) {
    console.error('[apple] revoke failed', res.status, await res.text());
    return false;
  }
  return true;
}
