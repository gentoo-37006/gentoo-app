import type { ComponentProps } from 'react';
import { ThemeProvider } from 'expo-router';

type NavTheme = NonNullable<ComponentProps<typeof ThemeProvider>['value']>;

const FONTS: NavTheme['fonts'] = {
  regular: { fontFamily: 'System', fontWeight: '400' },
  medium: { fontFamily: 'System', fontWeight: '500' },
  bold: { fontFamily: 'System', fontWeight: '700' },
  heavy: { fontFamily: 'System', fontWeight: '800' },
};

/**
 * React Navigation themes kept in sync with the CSS variables in global.css,
 * so navigator chrome (backgrounds, headers) matches the NativeWind design system.
 */
export const NAV_THEME: { light: NavTheme; dark: NavTheme } = {
  light: {
    dark: false,
    colors: {
      primary: '#2f6bf6',
      background: '#ffffff',
      card: '#ffffff',
      text: '#0f172a',
      border: '#e2e8f0',
      notification: '#e23b3b',
    },
    fonts: FONTS,
  },
  dark: {
    dark: true,
    colors: {
      primary: '#3b82f6',
      background: '#0a0f1d',
      card: '#0f1626',
      text: '#f8fafc',
      border: '#2a3447',
      notification: '#ef4444',
    },
    fonts: FONTS,
  },
};

export { useColorScheme } from 'nativewind';
