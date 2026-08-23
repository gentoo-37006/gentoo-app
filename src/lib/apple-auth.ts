import * as AppleAuthentication from 'expo-apple-authentication';
import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/env';
import { functionUrl } from '@/lib/function-url';
import type { SignInResult } from '@/lib/google-auth';

/**
 * Sign in with Apple — required by App Store guideline 4.8, which makes a
 * third-party login service (our Google button) conditional on offering an
 * equivalent that keeps the user's email private. Build 31 was rejected for
 * exactly this.
 *
 * Native only. Unlike Google this uses the identity-token flow rather than a
 * browser round trip: Apple's own sheet returns a signed JWT, which Supabase
 * verifies directly. Nothing to deep-link back from, so none of google-auth's
 * redirect-scheme handling applies.
 */

/** iOS 13+. Android and web have no Apple sheet, so the button must not render. */
export function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return Promise.resolve(false);
  return AppleAuthentication.isAvailableAsync();
}

/**
 * Apple hands over the user's name EXACTLY ONCE — on the first authorization
 * for this app, and never again, not even after deleting and reinstalling.
 * Everything afterwards returns fullName: null.
 *
 * That collides with handle_new_user() (migration 0001), which derives a name
 * from the email local part. With Private Relay the address is
 * <opaque>@privaterelay.appleid.com, so the roster would show "a1b2c3d4e5"
 * forever, and the Discord bot's assignee lookups would too. So we capture the
 * name on that single pass and write it through before it's lost.
 */
function formatName(fullName: AppleAuthentication.AppleAuthenticationFullName | null) {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/**
 * Only overwrite a name the trigger guessed from the email — never one the
 * user already set. A second Apple sign-in returns null anyway, so this runs
 * on the first pass or not at all.
 */
async function backfillName(userId: string, name: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', userId)
    .maybeSingle();

  const current = (data?.full_name ?? '').trim();
  // The trigger's fallback is the email local part, which for Private Relay is
  // the opaque relay id — never a name the user chose.
  const looksDerived = !current || !current.includes(' ');
  if (!looksDerived) return;

  await supabase.from('profiles').update({ full_name: name }).eq('id', userId);
}

/**
 * Hand Apple's one-time authorization code to the backend, which trades it for a
 * refresh token and banks it. Deleting the account later revokes that token, as
 * App Store guideline 5.1.1(v) requires — orphaning the Apple grant is not
 * enough. See supabase/functions/link-apple.
 *
 * Strictly best effort: the user is already signed in by the time this runs, and
 * nothing they can see depends on it. Apple issues a fresh code on every
 * authorization, so a failure here self-corrects at the next sign-in.
 */
async function linkAppleGrant(code: string, accessToken: string) {
  const endpoint = functionUrl(SUPABASE_URL, 'link-apple');
  if (!endpoint) return;

  try {
    await fetch(endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ code }),
    });
  } catch (e) {
    console.warn('[apple] could not store the authorization code:', e);
  }
}

export async function signInWithApple(): Promise<SignInResult> {
  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (e) {
    // Dismissing the sheet raises rather than returning, and is not an error
    // worth showing.
    if ((e as { code?: string })?.code === 'ERR_REQUEST_CANCELED') {
      return { cancelled: true };
    }
    return { error: 'Apple sign-in did not complete.' };
  }

  if (!credential.identityToken) {
    return { error: 'Apple did not return an identity token.' };
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
  });
  if (error) return { error: error.message };

  const name = formatName(credential.fullName);
  if (name && data.user) {
    // Best effort: a failure here costs a display name, not the session the
    // user just successfully established.
    try {
      await backfillName(data.user.id, name);
    } catch {
      // ignored on purpose — see above
    }
  }

  if (credential.authorizationCode && data.session?.access_token) {
    await linkAppleGrant(credential.authorizationCode, data.session.access_token);
  }

  return {};
}
