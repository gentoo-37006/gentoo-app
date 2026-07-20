import '@/global.css';
import * as ExpoCrypto from 'expo-crypto';

if (!globalThis.crypto) (globalThis as any).crypto = {};
if (!globalThis.crypto.getRandomValues) {
  (globalThis as any).crypto.getRandomValues = ExpoCrypto.getRandomValues;
}
if (!globalThis.crypto.subtle) {
  (globalThis as any).crypto.subtle = {
    digest: async (_alg: string, data: ArrayBuffer) =>
      ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data)),
  };
}

/* eslint-disable import/first -- the crypto polyfill above must install before
   app modules are evaluated (Metro executes requires in source order). */
import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import * as Updates from 'expo-updates';
import { Stack, ThemeProvider, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { useRestoreThemeMode } from '@/lib/theme-mode';
import { Providers } from '@/components/providers';
import { UpdateBanner } from '@/components/update-banner';
import { useAuth } from '@/lib/auth';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? NAV_THEME.dark : NAV_THEME.light;
  useRestoreThemeMode();
  useNativeUpdates();

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <Providers>
            <RootNavigator />
            <UpdateBanner />
          </Providers>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function useNativeUpdates() {
  React.useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;

    let cancelled = false;

    async function checkForUpdate() {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (cancelled || !update.isAvailable) return;

        await Updates.fetchUpdateAsync();
        if (!cancelled) await Updates.reloadAsync();
      } catch (error) {
        console.warn('[updates] check failed', error);
      }
    }

    checkForUpdate();

    return () => {
      cancelled = true;
    };
  }, []);
}

/**
 * Renders the navigator and enforces the auth gate: unauthenticated users land
 * on sign-in, signed-in-but-unapproved users on the pending screen, and
 * approved users in the app. The navigator stays mounted so redirects are safe.
 */
function RootNavigator() {
  const { initializing, isConfigured, session, profile } = useAuth();
  const segments = useSegments() as string[];
  const pathname = usePathname();
  const router = useRouter();
  const inAuthGroup = segments[0] === '(auth)';
  const onPublicDownloads = pathname === '/downloads';

  // Derived, not state: the overlay hides once the current route matches the
  // auth state, so there's never a flash of the wrong screen — including
  // mid-redirect frames, which the old setSettled(true) marker let through.
  let settled: boolean;
  if (initializing) settled = false;
  else if (!isConfigured || !session) settled = inAuthGroup || onPublicDownloads;
  // profile can be stale-null while the fetch for the current session is still
  // in flight (auth.tsx nulls it on user change). Wait for it.
  else if (!profile) settled = false;
  else if (profile.status !== 'approved') settled = segments[1] === 'pending';
  else settled = !inAuthGroup;

  // The effect only issues redirects; `settled` above tracks when they land.
  React.useEffect(() => {
    if (initializing) return;

    if (!isConfigured || !session) {
      if (!inAuthGroup && !onPublicDownloads) router.replace('/sign-in');
      return;
    }
    if (!profile) return;

    if (profile.status !== 'approved') {
      if (segments[1] !== 'pending') router.replace('/pending');
      return;
    }

    if (inAuthGroup) router.replace('/');
  }, [initializing, isConfigured, session, profile, segments, pathname, router, inAuthGroup, onPublicDownloads]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {!settled && (
        <View className="absolute inset-0 items-center justify-center bg-background">
          <ActivityIndicator size="large" />
        </View>
      )}
    </>
  );
}
