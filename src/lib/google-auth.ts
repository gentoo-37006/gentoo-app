import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

export type SignInResult = { error?: string; cancelled?: boolean };

/**
 * Native (iOS/Android) Google sign-in via Supabase OAuth + an in-app browser.
 * Opens Google in a web auth session, then exchanges the returned PKCE code for
 * a Supabase session. Works in dev builds and Expo Go.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  // Force the app's custom scheme so the OAuth callback deep-links back into the
  // native app. Without an explicit scheme, makeRedirectUri() resolves to the Metro
  // dev-server URL (http://localhost:8081) in dev builds, which opens the web app in
  // a browser and leaves the native app stuck. (Dev-client/standalone, not Expo Go.)
  // Single-segment path (no inner "/") so it matches Supabase's existing
  // `gentoo://*` redirect allow-list entry.
  const redirectTo = makeRedirectUri({ scheme: 'gentoo', path: 'callback' });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: 'Could not start Google sign-in.' };

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return { cancelled: true };
  }
  if (result.type !== 'success' || !result.url) {
    return { error: 'Google sign-in did not complete.' };
  }

  const { queryParams } = Linking.parse(result.url);
  const code = queryParams?.code;
  if (typeof code === 'string') {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) return { error: exchangeError.message };
    return {};
  }

  return { error: 'No authorization code was returned.' };
}
