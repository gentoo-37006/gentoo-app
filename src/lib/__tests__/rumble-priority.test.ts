import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finishRobotRumblePriority, isRobotRumbling, setRobotRumblePriority } from '../driver-station/rumble-priority';

beforeEach(() => { vi.useFakeTimers(); setRobotRumblePriority(null); });
afterEach(() => { setRobotRumblePriority(null); vi.useRealTimers(); });

describe('robot rumble priority', () => {
  it('takes priority immediately and releases it after native playback duration, including pauses', () => {
    const effect = { user: 1 as const, steps: [{ large: 255, small: 0, duration: 250 }, { large: 0, small: 0, duration: 100 }] };
    setRobotRumblePriority(effect);
    expect(isRobotRumbling()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(isRobotRumbling()).toBe(true);
    finishRobotRumblePriority(effect);
    vi.advanceTimersByTime(349);
    expect(isRobotRumbling()).toBe(true);
    vi.advanceTimersByTime(1);
    expect(isRobotRumbling()).toBe(false);
  });

  it('preserves continuous rumble until explicitly stopped or replaced', () => {
    const effect = { user: 2 as const, steps: [{ large: 255, small: 0, duration: -1 }] };
    setRobotRumblePriority(effect);
    finishRobotRumblePriority(effect);
    vi.advanceTimersByTime(60000);
    expect(isRobotRumbling()).toBe(true);
    setRobotRumblePriority({ user: 2, steps: [{ large: 0, small: 0, duration: -1 }] });
    expect(isRobotRumbling()).toBe(false);
  });
});
