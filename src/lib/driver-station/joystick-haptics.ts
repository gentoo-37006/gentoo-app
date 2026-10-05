export type JoystickTick = 'tick' | 'edge' | 'center';
type Stick = { distance: number; tickX: number; tickY: number; edge: boolean };

export class JoystickHapticFeedback {
  private sticks = new Map<string, Stick>();
  private lastPulseAt = -Infinity;

  constructor(
    private readonly pulse: (strength: number, kind: JoystickTick) => void,
    private readonly suppressed: () => boolean = () => false
  ) {}

  move(id: string, x: number, y: number) {
    x = Number.isFinite(x) ? x : 0;
    y = Number.isFinite(y) ? y : 0;
    const magnitude = Math.hypot(x, y);
    if (magnitude > 1) { x /= magnitude; y /= magnitude; }
    const distance = Math.min(1, magnitude);
    const previous = this.sticks.get(id) ?? { distance: 0, tickX: 0, tickY: 0, edge: false };
    const edge = distance >= (previous.edge ? 0.90 : 0.98);
    // Measuring from the last tick keeps tiny touch jitter quiet.
    const moved = Math.hypot(x - previous.tickX, y - previous.tickY) >= 0.1;
    const boundary = distance === 0 || (edge && !previous.edge);
    this.sticks.set(id, {
      distance, edge,
      tickX: moved || boundary ? x : previous.tickX,
      tickY: moved || boundary ? y : previous.tickY,
    });
    if (distance === 0 && previous.distance > 0) this.emit(0.15, 'center');
    else if (edge && !previous.edge) this.emit(1, 'edge');
    else if (moved) this.emit(0.15 + Math.log1p(9 * distance) / Math.log(10) * 0.65, 'tick');
  }

  release(id: string) {
    const previous = this.sticks.get(id);
    this.sticks.delete(id);
    if (previous && previous.distance > 0) this.emit(0.6, 'center');
  }

  dispose() {
    this.sticks.clear();
    this.lastPulseAt = -Infinity;
  }

  private emit(strength: number, kind: JoystickTick) {
    const now = Date.now();
    if (this.suppressed() || (kind === 'tick' && now - this.lastPulseAt < 55)) return;
    this.lastPulseAt = now;
    this.pulse(strength, kind);
  }
}
