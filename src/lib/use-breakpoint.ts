import { useWindowDimensions } from 'react-native';

// Mirror Tailwind's default breakpoints so JS layout decisions stay in sync
// with NativeWind `sm:`/`md:`/`lg:` utility classes.
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

/**
 * Responsive helpers driven by window width. Used to switch between the
 * phone layout (bottom tabs, single column) and the wide layout (sidebar,
 * multi-column) — the parts NativeWind classes alone can't express.
 */
export function useBreakpoint() {
  const { width, height } = useWindowDimensions();

  const isAtLeast = (bp: Breakpoint) => width >= BREAKPOINTS[bp];

  return {
    width,
    height,
    // Wide layout (sidebar + multi-column) kicks in on tablets / desktop web.
    isWide: width >= BREAKPOINTS.md,
    isDesktop: width >= BREAKPOINTS.lg,
    isPhone: width < BREAKPOINTS.md,
    isAtLeast,
  };
}
