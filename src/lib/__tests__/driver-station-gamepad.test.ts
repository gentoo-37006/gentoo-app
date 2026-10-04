import { describe, expect, it } from 'vitest';
import { joystickPosition, neutralGamepad } from '../driver-station/gamepad';
import { serializeGamepad } from '../driver-station/protocol';

describe('touch gamepad', () => {
  it('centers within the deadzone and clamps diagonals to a circle', () => {
    expect(joystickPosition(2, -2, 100)).toEqual({ x: 0, y: 0 });
    expect(joystickPosition(0, -100, 100)).toEqual({ x: 0, y: -1 });
    const point = joystickPosition(200, 200, 100);
    expect(Math.hypot(point.x, point.y)).toBeCloseTo(1);
    expect(point.x).toBeCloseTo(Math.SQRT1_2);
  });

  it('matches FTC SDK v5 field offsets and byte order', () => {
    const packet = serializeGamepad(0x1234, {
      ...neutralGamepad, leftStickX: -0.5, leftStickY: -1,
      rightStickX: 0.75, rightStickY: 1, leftTrigger: 0.5,
      rightTrigger: 1, buttons: 0x102,
    }, 123456);
    const view = new DataView(packet.buffer);
    expect(packet.length).toBe(65);
    expect(Array.from(packet.slice(0, 6))).toEqual([2, 0, 60, 0x12, 0x34, 5]);
    expect(view.getInt32(6)).toBe(-2);
    expect(view.getBigInt64(10)).toBe(123456n);
    expect([18, 22, 26, 30, 34, 38].map((offset) => view.getFloat32(offset))).toEqual([-0.5, -1, 0.75, 1, 0.5, 1]);
    expect(view.getUint32(42)).toBe(0x102);
    expect(Array.from(packet.slice(46))).toEqual([1, ...Array(18).fill(0)]);
  });

  it('does not put invalid axes on the wire', () => {
    const packet = serializeGamepad(1, { ...neutralGamepad, leftStickX: Infinity, rightStickY: 10, leftTrigger: -1 });
    const view = new DataView(packet.buffer);
    expect(view.getFloat32(18)).toBe(0);
    expect(view.getFloat32(30)).toBe(1);
    expect(view.getFloat32(34)).toBe(0);
  });

  it('assigns packets to gamepad 2', () => {
    expect(serializeGamepad(1, neutralGamepad, 100, 2)[46]).toBe(2);
  });
});
