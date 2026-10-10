import { describe, expect, it } from 'vitest';
import { parseRobotWifi, validateRobotWifi } from '../driver-station/wifi-settings';

describe('robot Wi-Fi settings', () => {
  it('accepts WPA2 or explicitly open networks without trimming credentials', () => {
    expect(validateRobotWifi({ ssid: '12345-RC', password: 'password' })).toBeNull();
    expect(parseRobotWifi(JSON.stringify({ ssid: ' robot ', password: '' }))).toEqual({ ssid: ' robot ', password: '' });
  });
  it('checks SSID byte length, password length, and malformed saved data', () => {
    expect(validateRobotWifi({ ssid: '', password: 'password' })).not.toBeNull();
    expect(validateRobotWifi({ ssid: '界'.repeat(11), password: 'password' })).not.toBeNull();
    expect(validateRobotWifi({ ssid: 'robot', password: 'short' })).not.toBeNull();
    expect(validateRobotWifi({ ssid: 'robot', password: 'p'.repeat(64) })).not.toBeNull();
    expect(parseRobotWifi('null')).toBeNull();
    expect(parseRobotWifi('{')).toBeNull();
    expect(parseRobotWifi('{"ssid":12,"password":"password"}')).toBeNull();
  });
});
