import * as SecureStore from 'expo-secure-store';
import { PermissionsAndroid, Platform } from 'react-native';
import { joinDriverStationWifi } from '../../../modules/gentoo-driver-station';
import { parseRobotWifi, validateRobotWifi, type RobotWifiSettings } from './wifi-settings';

const KEY = 'gentoo.driver-station.wifi.v1';

export async function readRobotWifi() {
  const raw = await SecureStore.getItemAsync(KEY);
  return raw ? parseRobotWifi(raw) : null;
}

export async function saveRobotWifi(settings: RobotWifiSettings) {
  const error = validateRobotWifi(settings);
  if (error) throw new Error(error);
  await SecureStore.setItemAsync(KEY, JSON.stringify(settings), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
}

export async function forgetRobotWifi() { await SecureStore.deleteItemAsync(KEY); }

export async function connectRobotWifi(settings: RobotWifiSettings) {
  const error = validateRobotWifi(settings);
  if (error) throw new Error(error);
  if (Platform.OS === 'android' && Number(Platform.Version) >= 29) {
    const permission = Number(Platform.Version) >= 33
      ? PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES
      : PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
    const granted = await PermissionsAndroid.request(permission);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Wi-Fi permission was not granted.');
  }
  return joinDriverStationWifi(settings.ssid, settings.password);
}
