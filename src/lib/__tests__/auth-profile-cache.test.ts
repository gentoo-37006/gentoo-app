import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Profile } from '@/lib/types';
import {
  readCachedProfile,
  removeCachedProfile,
  writeCachedProfile,
} from '@/lib/auth-profile-cache';

const storage = vi.hoisted(() => ({
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({ default: storage }));
vi.mock('react-native', () => ({ Platform: { OS: 'ios' } }));

const profile: Profile = {
  id: 'user-1',
  full_name: 'Max',
  email: 'max@example.com',
  avatar_url: null,
  role: 'member',
  functional_roles: [],
  status: 'approved',
  discord_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('auth profile cache', () => {
  beforeEach(() => vi.clearAllMocks());

  it('round-trips a verified profile', async () => {
    await writeCachedProfile(profile);
    expect(storage.setItem).toHaveBeenCalledWith(
      'gentoo.auth-profile.v1:user-1',
      JSON.stringify(profile)
    );

    storage.getItem.mockResolvedValueOnce(JSON.stringify(profile));
    await expect(readCachedProfile('user-1')).resolves.toEqual(profile);
  });

  it('rejects a cache entry belonging to another user', async () => {
    storage.getItem.mockResolvedValueOnce(JSON.stringify(profile));
    await expect(readCachedProfile('user-2')).resolves.toBeNull();
    expect(storage.removeItem).toHaveBeenCalledWith('gentoo.auth-profile.v1:user-2');
  });

  it('removes the cached profile on sign-out', async () => {
    await removeCachedProfile('user-1');
    expect(storage.removeItem).toHaveBeenCalledWith('gentoo.auth-profile.v1:user-1');
  });
});
