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
import { Animated, Easing, Image, Platform, View } from 'react-native';
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
import { useDatabaseRealtime } from '@/lib/use-database-realtime';

const LOADING_COLORS = {
  light: { background: '#FAFAFA', spinner: '#9F63DE' },
  dark: { background: '#0A0A0A', spinner: '#D8B4FE' },
} as const;

function LoadingSpinner({ color }: { color: string }) {
  const [rotation] = React.useState(() => new Animated.Value(0));
  const rotate = React.useMemo(
    () =>
      rotation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    [rotation]
  );

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 700,
        easing: Easing.linear,
        useNativeDriver: Platform.OS !== 'web',
      })
    );
    animation.start();
    return () => animation.stop();
  }, [rotation]);

  return (
    <View
      style={{ width: 105, height: 105, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 52.5,
          borderWidth: 3.125,
          borderColor: `${color}38`,
          borderTopColor: color,
          transform: [
            {
              rotate,
            },
          ],
        }}
      />
      <View
        style={{
          width: 92.5,
          height: 92.5,
          borderRadius: 46.25,
          overflow: 'hidden',
        }}
      >
        <Image
          source={require('../../assets/images/icon.png')}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </View>
    </View>
  );
}

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
  const { colorScheme } = useColorScheme();
  const { initializing, isConfigured, session, profile } = useAuth();
  useDatabaseRealtime();
  const loadingColors = LOADING_COLORS[colorScheme === 'dark' ? 'dark' : 'light'];
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
        <View
          className="absolute inset-0 items-center justify-center"
          style={{ backgroundColor: loadingColors.background }}
        >
          <LoadingSpinner color={loadingColors.spinner} />
        </View>
      )}
    </>
  );
}
