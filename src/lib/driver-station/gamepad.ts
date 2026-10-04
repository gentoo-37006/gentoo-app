export type GamepadState = {
  leftStickX: number;
  leftStickY: number;
  rightStickX: number;
  rightStickY: number;
  leftTrigger: number;
  rightTrigger: number;
  buttons: number;
};

export const neutralGamepad: GamepadState = {
  leftStickX: 0, leftStickY: 0, rightStickX: 0, rightStickY: 0,
  leftTrigger: 0, rightTrigger: 0, buttons: 0,
};

export function joystickPosition(x: number, y: number, radius: number) {
  const distance = Math.hypot(x, y);
  if (radius <= 0 || distance < radius * 0.08) return { x: 0, y: 0 };
  const scale = Math.max(radius, distance);
  return { x: x / scale, y: y / scale };
}

export function clampAxis(value: number, minimum = -1) {
  return Number.isFinite(value) ? Math.max(minimum, Math.min(1, value)) : 0;
}
