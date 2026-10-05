import { describe, expect, it } from 'vitest';
import { parseRumbleEffect } from '../driver-station/rumble';

describe('FTC rumble effects', () => {
  it('preserves motor intensities, pauses, and gamepad assignment', () => {
    const effect = { user: 2, steps: [{ large: 255, small: 128, duration: 250 }, { large: 0, small: 0, duration: 100 }] };
    expect(parseRumbleEffect(effect)).toEqual(effect);
  });

  it('accepts continuous rumble and the SDK stop command', () => {
    expect(parseRumbleEffect({ user: 1, steps: [{ large: 255, small: 0, duration: -1 }] })).not.toBeNull();
    expect(parseRumbleEffect({ user: 1, steps: [{ large: 0, small: 0, duration: -1 }] })).not.toBeNull();
    expect(parseRumbleEffect({ user: 1, steps: [] })).not.toBeNull();
  });

  it.each([
    null,
    { user: 3, steps: [] },
    { user: 1, steps: [{ large: 256, small: 0, duration: 100 }] },
    { user: 1, steps: [{ large: 255, small: 0, duration: -2 }] },
    { user: 1, steps: [{ large: 255, small: 0, duration: 1.5 }] },
    { user: 1, steps: [{ large: 255, small: 0, duration: -1 }, { large: 0, small: 0, duration: 100 }] },
    { user: 1, steps: Array(129).fill({ large: 255, small: 0, duration: 100 }) },
    { user: 1, steps: Array(3).fill({ large: 255, small: 0, duration: 60000 }) },
  ])('rejects malformed or oversized effect %j', (effect) => {
    expect(parseRumbleEffect(effect)).toBeNull();
  });
});
