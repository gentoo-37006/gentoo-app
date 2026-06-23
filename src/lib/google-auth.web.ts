import { supabase } from '@/lib/supabase';

export type SignInResult = { error?: string; cancelled?: boolean };

/**
 * Web Google sign-in. Redirects the page to Google; on return, the Supabase
 * client (detectSessionInUrl + PKCE) completes the exchange automatically.
 */
export async function signInWithGoogle(): Promise<SignInResult> {
  const redirectTo = typeof window !== 'undefined' ? window.location.origin : undefined;
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) return { error: error.message };
  // The browser navigates away to Google; this resolves before that completes.
  return {};
}
