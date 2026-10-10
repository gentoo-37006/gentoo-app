import { beforeEach, describe, expect, it, vi } from 'vitest';
import { forgetDriverStation, isDriverStationResume, rememberDriverStation, shouldResumeDriverStation } from '../driver-station/resume';

const storage = vi.hoisted(() => ({ getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() }));
vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
beforeEach(() => vi.clearAllMocks());

describe('Driver Station resume', () => {
  it('restores only a recent marker for the same account', () => {
    expect(isDriverStationResume({ userId: 'a', at: 100 }, 'a', 200)).toBe(true);
    expect(isDriverStationResume({ userId: 'a', at: 100 }, 'b', 200)).toBe(false);
    expect(isDriverStationResume({ userId: 'a', at: 100 }, 'a', 13 * 3600000)).toBe(false);
    expect(isDriverStationResume({ userId: 'a', at: 300 }, 'a', 200)).toBe(false);
    expect(isDriverStationResume(null, 'a', 200)).toBe(false);
  });
  it('saves and explicitly clears the marker', async () => {
    await rememberDriverStation('a');
    const [key, raw] = storage.setItem.mock.calls[0];
    storage.getItem.mockResolvedValueOnce(raw);
    await expect(shouldResumeDriverStation('a')).resolves.toBe(true);
    await forgetDriverStation();
    expect(storage.removeItem).toHaveBeenCalledWith(key);
  });
  it('ignores malformed saved data', async () => {
    storage.getItem.mockResolvedValueOnce('{');
    await expect(shouldResumeDriverStation('a')).resolves.toBe(false);
  });
});
