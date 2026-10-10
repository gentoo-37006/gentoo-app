import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'gentoo.driver-station.resume.v1';
const MAX_AGE = 12 * 60 * 60 * 1000;

export function isDriverStationResume(value: unknown, userId: string, now: number): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as { userId?: unknown; at?: unknown };
  return record.userId === userId && typeof record.at === 'number' &&
    Number.isFinite(record.at) && now >= record.at && now - record.at < MAX_AGE;
}

export async function rememberDriverStation(userId: string) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify({ userId, at: Date.now() })); }
  catch (error) { console.warn('[driver-station] failed to save route', error); }
}

export async function forgetDriverStation() {
  try { await AsyncStorage.removeItem(KEY); }
  catch (error) { console.warn('[driver-station] failed to clear route', error); }
}

export async function shouldResumeDriverStation(userId: string) {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? isDriverStationResume(JSON.parse(raw), userId, Date.now()) : false;
  } catch { return false; }
}
