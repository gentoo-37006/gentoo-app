import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

function runHaptic(feedback: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  void feedback().catch(() => {});
}

export function hapticReorderPickup() {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

export function hapticReorderTargetChange() {
  runHaptic(() => Haptics.selectionAsync());
}

export function hapticReorderDrop() {
  runHaptic(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}
