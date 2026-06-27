import '@/global.css';
import * as ExpoCrypto from 'expo-crypto';

if (!global.crypto) (global as any).crypto = {};
if (!global.crypto.getRandomValues) {
  (global as any).crypto.getRandomValues = ExpoCrypto.getRandomValues;
}
if (!global.crypto.subtle) {
  (global as any).crypto.subtle = {
    digest: async (_alg: string, data: ArrayBuffer) =>
      ExpoCrypto.digest(ExpoCrypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(data)),
  };
}

import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, ThemeProvider, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { NAV_THEME } from '@/lib/theme';
import { Providers } from '@/components/providers';
import { useAuth } from '@/lib/auth';

export default function RootLayout() {
  const { colorScheme } = useColorScheme();
  const theme = colorScheme === 'dark' ? NAV_THEME.dark : NAV_THEME.light;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={theme}>
          <Providers>
            <RootNavigator />
          </Providers>
          <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Renders the navigator and enforces the auth gate: unauthenticated users land
 * on sign-in, signed-in-but-unapproved users on the pending screen, and
 * approved users in the app. The navigator stays mounted so redirects are safe.
 */
function RootNavigator() {
  const { initializing, isConfigured, session, profile } = useAuth();
  const segments = useSegments() as string[];
  const router = useRouter();
  // Stays false until the first routing decision has been executed, preventing
  // a one-frame flash of the wrong screen between when initializing becomes
  // false and when the effect below actually fires.
  const [settled, setSettled] = React.useState(false);

  React.useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isConfigured || !session) {
      if (!inAuthGroup) router.replace('/sign-in');
      setSettled(true);
      return;
    }

    // profileResolved can be stale (true from a prior null-userId run) while the
    // real profile fetch for the current session is still in flight. Wait for it.
    if (!profile) return;

    if (profile.status !== 'approved') {
      if (segments[1] !== 'pending') router.replace('/pending');
      setSettled(true);
      return;
    }

    if (inAuthGroup) router.replace('/');
    setSettled(true);
  }, [initializing, isConfigured, session, profile, segments, router]);

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
