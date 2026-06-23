import { supabase } from '@/lib/supabase';
import { SUPABASE_ANON_KEY } from '@/lib/env';

export type SignInResult = { error?: string; cancelled?: boolean };

/**
 * Web Google sign-in. We build the OAuth URL (skipBrowserRedirect) and redirect
 * manually so we can guarantee the `apikey` is present — some gateway configs
 * reject the /authorize hop without it ("No API key found in request"). On the
 * way back, the Supabase client (detectSessionInUrl + PKCE) completes the exchange.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) return { error: error.message };
  if (!data?.url) return { error: 'Could not start Google sign-in.' };

  const url = new URL(data.url);
  if (!url.searchParams.get('apikey')) {
    url.searchParams.set('apikey', SUPABASE_ANON_KEY);
  }
  window.location.href = url.toString();
  return {};
}
