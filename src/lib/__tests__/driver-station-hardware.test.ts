import { describe, expect, it } from 'vitest';
import {
  listHardwareNames,
  renameHardware,
  validateHardwareNames,
} from '../driver-station/hardware-config';

const CONFIGURATION = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Robot type="FirstInspires-FTC">
  <LynxUsbDevice name="Control Hub Portal" serialNumber="(embedded)">
    <LynxModule name="Control Hub" port="173">
      <Motor name="leftDrive" port="0" />
      <Motor name="rightDrive" port="1" />
    </LynxModule>
  </LynxUsbDevice>
</Robot>`;

describe('Driver Station hardware names', () => {
  it('lists nested hardware with stable ids and ports', () => {
    const hardware = listHardwareNames(CONFIGURATION);
    expect(hardware.map(({ tag, name, port, depth }) => ({ tag, name, port, depth }))).toEqual([
      { tag: 'LynxUsbDevice', name: 'Control Hub Portal', port: undefined, depth: 1 },
      { tag: 'LynxModule', name: 'Control Hub', port: '173', depth: 2 },
      { tag: 'Motor', name: 'leftDrive', port: '0', depth: 3 },
      { tag: 'Motor', name: 'rightDrive', port: '1', depth: 3 },
    ]);
  });

  it('renames one device while preserving hardware attributes', () => {
    const motor = listHardwareNames(CONFIGURATION).find((item) => item.name === 'leftDrive')!;
    const renamed = renameHardware(CONFIGURATION, motor.id, 'frontLeft');
    expect(renamed).toContain('name="frontLeft"');
    expect(renamed).toContain('port="0"');
    expect(renamed).toContain('serialNumber="(embedded)"');
  });

  it('rejects duplicate names', () => {
    const motor = listHardwareNames(CONFIGURATION).find((item) => item.name === 'rightDrive')!;
    const duplicate = renameHardware(CONFIGURATION, motor.id, 'leftDrive');
    expect(validateHardwareNames(duplicate)).toContain('used by more than one');
  });
});
