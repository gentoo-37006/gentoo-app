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
      primary: '#9f63de',
      background: '#fafafa',
      card: '#ffffff',
      text: '#141414',
      border: '#dbdbdb',
      notification: '#d32f2f',
    },
    fonts: FONTS,
  },
  dark: {
    dark: true,
    colors: {
      primary: '#d8b4fe',
      background: '#121212',
      card: '#1c1c1c',
      text: '#f5f5f5',
      border: '#454545',
      notification: '#e5484d',
    },
    fonts: FONTS,
  },
};

export { useColorScheme } from 'nativewind';
