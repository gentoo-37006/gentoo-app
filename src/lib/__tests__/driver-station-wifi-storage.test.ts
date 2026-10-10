import { beforeEach, describe, expect, it, vi } from 'vitest';
import { connectRobotWifi, forgetRobotWifi, readRobotWifi, saveRobotWifi } from '../driver-station/wifi';

const secure = vi.hoisted(() => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn(), deleteItemAsync: vi.fn(), WHEN_UNLOCKED_THIS_DEVICE_ONLY: 6 }));
const native = vi.hoisted(() => ({ joinDriverStationWifi: vi.fn() }));
const permission = vi.hoisted(() => ({ request: vi.fn(), PERMISSIONS: { NEARBY_WIFI_DEVICES: 'nearby', ACCESS_FINE_LOCATION: 'location' }, RESULTS: { GRANTED: 'granted' } }));
const platform = vi.hoisted(() => ({ OS: 'android', Version: 33 }));
vi.mock('expo-secure-store', () => secure);
vi.mock('../../../modules/gentoo-driver-station', () => native);
vi.mock('react-native', () => ({ Platform: platform, PermissionsAndroid: permission }));
beforeEach(() => { vi.clearAllMocks(); platform.OS = 'android'; platform.Version = 33; });

describe('robot Wi-Fi secure storage and joining', () => {
  it('stores credentials only in device-bound secure storage and supports forgetting', async () => {
    const settings = { ssid: 'robot', password: 'password' };
    await saveRobotWifi(settings);
    expect(secure.setItemAsync).toHaveBeenCalledWith('gentoo.driver-station.wifi.v1', JSON.stringify(settings), { keychainAccessible: 6 });
    secure.getItemAsync.mockResolvedValueOnce(JSON.stringify(settings));
    await expect(readRobotWifi()).resolves.toEqual(settings);
    await forgetRobotWifi();
    expect(secure.deleteItemAsync).toHaveBeenCalledWith('gentoo.driver-station.wifi.v1');
  });
  it('does not ask the native join API when permission is refused', async () => {
    permission.request.mockResolvedValueOnce('denied');
    await expect(connectRobotWifi({ ssid: 'robot', password: 'password' })).rejects.toThrow('permission');
    expect(permission.request).toHaveBeenCalledWith('nearby');
    expect(native.joinDriverStationWifi).not.toHaveBeenCalled();
  });
  it('requests location only on older Android and passes exact credentials', async () => {
    platform.Version = 31;
    permission.request.mockResolvedValueOnce('granted');
    native.joinDriverStationWifi.mockResolvedValueOnce('requested');
    await expect(connectRobotWifi({ ssid: 'robot ', password: 'password' })).resolves.toBe('requested');
    expect(permission.request).toHaveBeenCalledWith('location');
    expect(native.joinDriverStationWifi).toHaveBeenCalledWith('robot ', 'password');
  });
  it('uses the native iOS approval API without requesting Android permissions', async () => {
    platform.OS = 'ios';
    native.joinDriverStationWifi.mockResolvedValueOnce('settings-required');
    await expect(connectRobotWifi({ ssid: 'robot', password: '' })).resolves.toBe('settings-required');
    expect(permission.request).not.toHaveBeenCalled();
  });
});
