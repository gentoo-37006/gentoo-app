import '@/global.css';

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

  React.useEffect(() => {
    if (initializing) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!isConfigured || !session) {
      if (!inAuthGroup) router.replace('/sign-in');
      return;
    }

    if (profile?.status !== 'approved') {
      if (segments[1] !== 'pending') router.replace('/pending');
      return;
    }

    if (inAuthGroup) router.replace('/');
  }, [initializing, isConfigured, session, profile, segments, router]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }} />
      {initializing && (
        <View className="absolute inset-0 items-center justify-center bg-background">
          <ActivityIndicator size="large" />
        </View>
      )}
    </>
  );
}
