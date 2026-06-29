import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';

export type ThemeMode = 'light' | 'dark' | 'system';

const STORAGE_KEY = 'gentoo.theme-mode';

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
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
 * Restores the persisted appearance choice and applies it via NativeWind.
 * Call once near the app root so the saved theme takes effect on every load.
 */
export function useRestoreThemeMode(): void {
  const { setColorScheme } = useColorScheme();
  React.useEffect(() => {
    let cancelled = false;
    loadThemeMode().then((mode) => {
      if (!cancelled) setColorScheme(mode);
    });
    return () => {
      cancelled = true;
    };
  }, [setColorScheme]);
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
      setColorScheme(next);
      void saveThemeMode(next);
    },
    [setColorScheme]
  );

  return { mode, setMode };
}
