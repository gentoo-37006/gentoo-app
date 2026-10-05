import * as Haptics from 'expo-haptics';
import { playDriverStationJoystickTick } from '../../../modules/gentoo-driver-station';
import { isRobotRumbling } from './rumble-priority';
import type { JoystickTick } from './joystick-haptics';

export function joystickHapticPulse(strength: number, kind: JoystickTick) {
  if (isRobotRumbling()) return;
  void playDriverStationJoystickTick(strength, kind === 'edge' ? 0.9 : kind === 'center' ? 0.45 : 0.55).catch(() => {});
}

export function controllerPressHaptic(strong = false) {
  if (isRobotRumbling()) return;
  void Haptics.impactAsync(strong ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

export function controllerReleaseHaptic() {
  if (isRobotRumbling()) return;
  void Haptics.selectionAsync().catch(() => {});
}
