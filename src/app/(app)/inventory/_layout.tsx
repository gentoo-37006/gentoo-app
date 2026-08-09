import { Stack } from 'expo-router';

/**
 * Anchor the stack to the list.
 *
 * A printed QR label deep-links straight to /inventory/[partId], which without
 * this builds a stack containing ONLY the detail screen. That strands it: the
 * iOS edge-swipe gesture has nothing to pop back to, and ScreenHeader's Back
 * falls through to `router.replace('/inventory')` — which navigates, but as a
 * fresh entry rather than a return, so the list loses its scroll position and
 * any active search or category filter.
 *
 * Anchoring puts `index` underneath, so a scanned part behaves exactly like one
 * opened by tapping through the list.
 *
 * `anchor` is expo-router's current name for this setting; `initialRouteName`
 * is the legacy alias, still read as a fallback (see getRoutesCore).
 */
export const unstable_settings = { anchor: 'index' };

export default function InventoryLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
