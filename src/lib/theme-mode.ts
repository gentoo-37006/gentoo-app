import * as React from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gentoo.theme-mode';

// The mode currently in effect, shared so the OS-theme listener in
// useRestoreThemeMode knows whether "system" is active when the OS flips.
let currentMode: ThemeMode = 'system';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function prefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Tailwind runs `darkMode: 'class'` (required for the manual Light/Dark picker
 * on web), which has no media-query fallback: passing 'system' to NativeWind on
 * web never applies the `dark` class. So on web, resolve 'system' to the actual
 * OS scheme ourselves; native keeps 'system' (RN Appearance handles it).
 */
function resolveScheme(mode: ThemeMode): 'light' | 'dark' | 'system' {
  if (mode !== 'system' || Platform.OS !== 'web') return mode;
  return prefersDark() ? 'dark' : 'light';
}

/** Reads the persisted appearance choice; defaults to 'system'. */
export async function loadThemeMode(): Promise<ThemeMode> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isThemeMode(stored)) return stored;
  } catch {
    // Storage unavailable — fall through to the default.
  }
  return 'system';
}

/** Persists the appearance choice so it survives a reload. */
async function saveThemeMode(mode: ThemeMode): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Best effort; the in-memory scheme still applies for this session.
  }
}

/**
 * Loads the persisted appearance choice, then applies it when allowed. Native
 * startup defers that second step until the OS splash is fully gone so changing
 * the app appearance cannot switch the still-visible native splash variant.
 */
export function useRestoreThemeMode(apply: boolean = true) {
  const { setColorScheme } = useColorScheme();
  const [loadedMode, setLoadedMode] = React.useState<ThemeMode | null>(null);
  const [restored, setRestored] = React.useState(false);
  const applyScheme = React.useEffectEvent((mode: ThemeMode) => {
    currentMode = mode;
    setColorScheme(resolveScheme(mode));
  });

  React.useEffect(() => {
    let cancelled = false;
    loadThemeMode().then((mode) => {
      if (cancelled) return;
      setLoadedMode(mode);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (!apply || loadedMode === null) return;

    applyScheme(loadedMode);
    const readyFrame = requestAnimationFrame(() => setRestored(true));
    return () => cancelAnimationFrame(readyFrame);
  }, [apply, loadedMode]);

  React.useEffect(() => {
    // Follow the OS while in system mode (web/desktop; native handles this
    // itself via Appearance).
    let unsubscribe: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const query = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => {
        if (currentMode === 'system') applyScheme('system');
      };
      query.addEventListener('change', onChange);
      unsubscribe = () => query.removeEventListener('change', onChange);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  return { loaded: loadedMode !== null, restored };
}

/**
 * Appearance state for the settings picker: the current mode plus a setter that
 * both applies the scheme and persists it. Initializes from storage so the
 * picker reflects the saved choice after a reload.
 */
export function useThemeMode() {
  const { setColorScheme } = useColorScheme();
  const [mode, setModeState] = React.useState<ThemeMode>('system');

  React.useEffect(() => {
    let cancelled = false;
    loadThemeMode().then((stored) => {
      if (!cancelled) setModeState(stored);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = React.useCallback(
    (next: ThemeMode) => {
      setModeState(next);
      currentMode = next;
      setColorScheme(resolveScheme(next));
      void saveThemeMode(next);
    },
    [setColorScheme]
  );

  return { mode, setMode };
}
