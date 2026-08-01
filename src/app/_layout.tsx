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
import {
  Animated,
  Appearance,
  Easing,
  Image,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
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

const SPLASH_FADE_DURATION = 75;

if (Platform.OS !== 'web') {
  SplashScreen.setOptions({ duration: SPLASH_FADE_DURATION, fade: true });
  void SplashScreen.preventAutoHideAsync();
}

const LOADING_COLORS = {
  light: { background: '#FAFAFA' },
  dark: { background: '#0A0A0A' },
} as const;

function LoadingSplash({
  visible,
  backgroundColor,
  imageSource,
  onReady,
}: {
  visible: boolean;
  backgroundColor: string;
  imageSource: ImageSourcePropType;
  onReady?: () => void;
}) {
  const [opacity] = React.useState(() => new Animated.Value(1));

  React.useEffect(() => {
    if (visible) {
      opacity.stopAnimation();
      opacity.setValue(1);
      return;
    }

    const animation = Animated.timing(opacity, {
      toValue: 0,
      duration: SPLASH_FADE_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [opacity, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? 'auto' : 'none'}
      style={[
        styles.loadingSplash,
        { backgroundColor, opacity },
      ]}
    >
      <View style={styles.loadingLogo}>
        <Image
          source={imageSource}
          resizeMode="cover"
          style={styles.loadingLogoImage}
          onLoad={onReady}
          onError={onReady}
        />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  loadingSplash: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingLogo: {
    height: 370,
    width: 370,
  },
  loadingLogoImage: {
    height: '100%',
    width: '100%',
  },
});

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
  useDatabaseRealtime();
  const [nativeSplashTheme] = React.useState<'light' | 'dark'>(() =>
    Appearance.getColorScheme() === 'dark' ? 'dark' : 'light'
  );
  const nativeSplashBackground = LOADING_COLORS[nativeSplashTheme].background;
  const nativeSplashImage =
    nativeSplashTheme === 'dark'
      ? require('../../assets/images/splash-icon-dark.png')
      : require('../../assets/images/splash-icon-light.png');
  const [nativeSplashImageReady, setNativeSplashImageReady] = React.useState(false);
  const [nativeSplashReleased, setNativeSplashReleased] = React.useState(
    Platform.OS === 'web'
  );
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

  React.useEffect(() => {
    if (
      Platform.OS === 'web' ||
      !nativeSplashImageReady ||
      nativeSplashReleased
    ) {
      return;
    }

    let releaseTimer: ReturnType<typeof setTimeout> | undefined;
    let handoffFrame: number | undefined;
    const paintFrame = requestAnimationFrame(() => {
      handoffFrame = requestAnimationFrame(() => {
        void SplashScreen.hideAsync();
        releaseTimer = setTimeout(
          () => setNativeSplashReleased(true),
          SPLASH_FADE_DURATION
        );
      });
    });

    return () => {
      cancelAnimationFrame(paintFrame);
      if (handoffFrame !== undefined) cancelAnimationFrame(handoffFrame);
      if (releaseTimer) clearTimeout(releaseTimer);
    };
  }, [nativeSplashImageReady, nativeSplashReleased]);

  React.useEffect(() => {
    if (Platform.OS !== 'web' || !settled) return;
    const staticSplash = document.getElementById('gentoo-static-splash');
    if (!staticSplash || staticSplash.dataset.hiding === 'true') return;
    staticSplash.dataset.hiding = 'true';
    staticSplash.style.opacity = '0';
    window.setTimeout(() => staticSplash.remove(), SPLASH_FADE_DURATION);
  }, [settled]);

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
      {Platform.OS !== 'web' ? (
        <LoadingSplash
          visible={!settled || !nativeSplashReleased}
          backgroundColor={nativeSplashBackground}
          imageSource={nativeSplashImage}
          onReady={() => setNativeSplashImageReady(true)}
        />
      ) : null}
    </>
  );
}
