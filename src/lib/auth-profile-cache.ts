import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { Profile } from '@/lib/types';

const PROFILE_CACHE_PREFIX = 'gentoo.auth-profile.v1';

function profileCacheKey(userId: string) {
  return `${PROFILE_CACHE_PREFIX}:${userId}`;
}

export async function readCachedProfile(userId: string): Promise<Profile | null> {
  if (Platform.OS === 'web') return null;

  try {
    const raw = await AsyncStorage.getItem(profileCacheKey(userId));
    if (!raw) return null;

    const profile = JSON.parse(raw) as Partial<Profile>;
    if (
      profile.id !== userId ||
      typeof profile.role !== 'string' ||
      typeof profile.status !== 'string'
    ) {
      await AsyncStorage.removeItem(profileCacheKey(userId));
      return null;
    }
    return profile as Profile;
  } catch (error) {
    console.warn('[auth] failed to read cached profile', error);
    return null;
  }
}

export async function writeCachedProfile(profile: Profile): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await AsyncStorage.setItem(profileCacheKey(profile.id), JSON.stringify(profile));
  } catch (error) {
    console.warn('[auth] failed to cache profile', error);
  }
}

export async function removeCachedProfile(userId: string): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    await AsyncStorage.removeItem(profileCacheKey(userId));
  } catch (error) {
    console.warn('[auth] failed to remove cached profile', error);
  }
}
