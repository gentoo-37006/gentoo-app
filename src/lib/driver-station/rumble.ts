export type RumbleStep = { large: number; small: number; duration: number };
export type RumbleEffect = { user: 1 | 2; steps: RumbleStep[] };

export function parseRumbleEffect(value: unknown): RumbleEffect | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RumbleEffect>;
  if (candidate.user !== 1 && candidate.user !== 2) return null;
  if (!Array.isArray(candidate.steps) || candidate.steps.length > 128) return null;
  const steps: RumbleStep[] = [];
  let total = 0;
  for (const step of candidate.steps) {
    if (!step || typeof step !== 'object') return null;
    if (![step.large, step.small, step.duration].every(Number.isInteger)) return null;
    if (step.large < 0 || step.large > 255 || step.small < 0 || step.small > 255) return null;
    if (step.duration < -1 || step.duration > 60_000) return null;
    if (step.duration === -1 && candidate.steps.length !== 1) return null;
    total += Math.max(0, step.duration);
    if (total > 120_000) return null;
    steps.push({ large: step.large, small: step.small, duration: step.duration });
  }
  return { user: candidate.user, steps };
}
