import type { OpMode } from './client';

export type OpModeCategory = 'AUTONOMOUS' | 'TELEOP' | 'OTHER';

export function opModesForCategory(opModes: OpMode[], category: OpModeCategory) {
  return opModes.filter((opMode) => category === 'OTHER'
    ? opMode.flavor !== 'AUTONOMOUS' && opMode.flavor !== 'TELEOP'
    : opMode.flavor === category);
}

export function selectedOpModeForCategory(opModes: OpMode[], category: OpModeCategory, selected: string | null) {
  const options = opModesForCategory(opModes, category);
  return options.find((opMode) => opMode.name === selected)?.name ?? options[0]?.name ?? null;
}
