import { playDriverStationRumble, stopDriverStationRumble } from '../../../modules/gentoo-driver-station';
import type { RumbleEffect } from './rumble';
import { finishRobotRumblePriority, setRobotRumblePriority } from './rumble-priority';

let generation = 0;
let pending = Promise.resolve();

export function setPhoneRumble(effect: RumbleEffect | null) {
  const current = ++generation;
  setRobotRumblePriority(effect);
  pending = pending.catch(() => undefined).then(async () => {
    if (current !== generation) return;
    if (effect) {
      await playDriverStationRumble(effect.steps);
      if (current === generation) finishRobotRumblePriority(effect);
    }
    else await stopDriverStationRumble();
  }).catch(() => {
    if (current === generation) setRobotRumblePriority(null);
  });
}
