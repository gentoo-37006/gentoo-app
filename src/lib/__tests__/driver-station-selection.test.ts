import { describe, expect, it } from 'vitest';
import { opModesForCategory, selectedOpModeForCategory } from '../driver-station/opmode-selection';
import { canReloadNativeUpdate } from '../native-update-policy';

const opModes = [
  { name: 'Auto', flavor: 'AUTONOMOUS', group: '' },
  { name: 'Drive', flavor: 'TELEOP', group: '' },
  { name: 'Inspect', flavor: 'UTILITY', group: '' },
];

describe('Driver Station selection', () => {
  it('separates autonomous and teleop and keeps utility OpModes accessible', () => {
    expect(opModesForCategory(opModes, 'AUTONOMOUS').map((mode) => mode.name)).toEqual(['Auto']);
    expect(opModesForCategory(opModes, 'TELEOP').map((mode) => mode.name)).toEqual(['Drive']);
    expect(opModesForCategory(opModes, 'OTHER').map((mode) => mode.name)).toEqual(['Inspect']);
  });
  it('never carries a selected OpMode into a different category', () => {
    expect(selectedOpModeForCategory(opModes, 'AUTONOMOUS', 'Drive')).toBe('Auto');
    expect(selectedOpModeForCategory(opModes, 'TELEOP', 'Drive')).toBe('Drive');
    expect(selectedOpModeForCategory([], 'TELEOP', 'Drive')).toBeNull();
  });
  it('does not reload a native update while Driver Station is open', () => {
    expect(canReloadNativeUpdate('/driver-station')).toBe(false);
    expect(canReloadNativeUpdate('/')).toBe(true);
  });
});
