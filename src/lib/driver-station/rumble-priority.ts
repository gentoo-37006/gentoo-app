import type { RumbleEffect } from './rumble';

let busy = false;
let expiration: ReturnType<typeof setTimeout> | null = null;

export function isRobotRumbling() { return busy; }

export function setRobotRumblePriority(effect: RumbleEffect | null) {
  if (expiration) clearTimeout(expiration);
  expiration = null;
  busy = Boolean(effect?.steps.some((step) => (step.large > 0 || step.small > 0) && step.duration !== 0));
}

export function finishRobotRumblePriority(effect: RumbleEffect) {
  if (!busy || effect.steps.some((step) => step.duration === -1)) return;
  const duration = effect.steps.reduce((sum, step) => sum + step.duration, 0);
  expiration = setTimeout(() => { busy = false; expiration = null; }, duration);
}
