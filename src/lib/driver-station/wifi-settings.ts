export type RobotWifiSettings = { ssid: string; password: string };

export function validateRobotWifi(settings: RobotWifiSettings): string | null {
  const ssidLength = new TextEncoder().encode(settings.ssid).length;
  if (ssidLength === 0 || ssidLength > 32 || settings.ssid.includes('\0')) return 'Network name must be 1-32 bytes.';
  if (settings.password && !/^[\x20-\x7e]{8,63}$/.test(settings.password)) return 'WPA2 password must be 8-63 characters, or empty for an open network.';
  return null;
}

export function parseRobotWifi(raw: string): RobotWifiSettings | null {
  try {
    const value = JSON.parse(raw);
    if (!value || typeof value.ssid !== 'string' || typeof value.password !== 'string') return null;
    return validateRobotWifi(value) ? null : { ssid: value.ssid, password: value.password };
  } catch { return null; }
}
