import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/env';
import { fetchWithTimeout } from '@/lib/auth-startup';

const isWeb = Platform.OS === 'web';
export const authStorageKey = `sb-${new URL(SUPABASE_URL || 'https://placeholder.supabase.co').hostname.split('.')[0]}-auth-token`;

/**
 * Shared Supabase client. Falls back to harmless placeholder credentials when
 * the app is unconfigured so imports never throw; callers should gate real
 * usage behind `isSupabaseConfigured`.
 */
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key',
  {
    global: { fetch: (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const accountRequest = url.pathname.startsWith('/auth/v1/') || url.pathname === '/rest/v1/profiles';
      return accountRequest ? fetchWithTimeout(input, init) : fetch(input, init);
    } },
    auth: {
      storageKey: authStorageKey,
      // Web uses localStorage by default; native persists via AsyncStorage.
      storage: isWeb ? undefined : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Web completes OAuth via a redirect back to the page with the session in the URL.
      detectSessionInUrl: isWeb,
      // PKCE so native can exchange the returned code for a session.
      flowType: 'pkce',
    },
  }
);
