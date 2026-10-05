import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { JoystickHapticFeedback } from '../driver-station/joystick-haptics';

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('joystick movement feedback', () => {
  it('boosts small displacements with a logarithmic strength curve', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    feedback.move('left', 0.12, 0);
    const low = pulse.mock.calls.at(-1)![0];
    expect(low).toBeCloseTo(0.15 + Math.log1p(9 * 0.12) / Math.log(10) * 0.65);
    expect(low).toBeGreaterThan(0.15 + 0.12 * 0.65);
    vi.advanceTimersByTime(60);
    feedback.move('left', 0.96, 0);
    expect(pulse.mock.calls.at(-1)![0]).toBeLessThanOrEqual(0.8);
  });

  it('increases strength toward the edge, with distinct edge and center cues', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    for (const x of [0.12, 0.24, 0.36, 0.48, 0.6, 0.72, 0.84, 0.96]) {
      vi.advanceTimersByTime(60);
      feedback.move('left', x, 0);
    }
    const strengths = pulse.mock.calls.map(([strength]) => strength);
    expect(strengths).toHaveLength(8);
    expect(new Set(strengths).size).toBe(8);
    expect(strengths).toEqual([...strengths].sort((a, b) => a - b));
    feedback.move('left', 1, 0);
    expect(pulse).toHaveBeenLastCalledWith(1, 'edge');
    feedback.move('left', 0, 0);
    expect(pulse).toHaveBeenLastCalledWith(0.15, 'center');
  });

  it('stays silent while held still and ignores small touch jitter', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    feedback.move('left', 0.5, 0);
    pulse.mockClear();
    for (let i = 0; i < 20; i++) {
      vi.advanceTimersByTime(100);
      feedback.move('left', 0.5 + (i % 2 ? 0.01 : -0.01), 0.01);
    }
    vi.advanceTimersByTime(10000);
    expect(pulse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ticks faster for faster movement over the same distance', () => {
    function tickTimes(interval: number) {
      const times: number[] = [];
      const feedback = new JoystickHapticFeedback(() => times.push(Date.now()));
      for (let i = 1; i <= 7; i++) {
        vi.advanceTimersByTime(interval);
        feedback.move('left', i * 0.12, 0);
      }
      return times.slice(1).map((time, i) => time - times[i]);
    }
    expect(tickTimes(200)).toEqual(Array(6).fill(200));
    expect(tickTimes(60)).toEqual(Array(6).fill(60));
  });

  it('ticks for sideways motion at a constant distance from center', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    feedback.move('left', 0.5, 0);
    vi.advanceTimersByTime(60);
    feedback.move('left', 0, 0.5);
    expect(pulse).toHaveBeenCalledTimes(2);
    expect(pulse.mock.calls[0]).toEqual(pulse.mock.calls[1]);
  });

  it('tracks both sticks independently and stops after release or disposal', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    feedback.move('left', 0.5, 0);
    vi.advanceTimersByTime(60);
    feedback.move('right', -0.5, 0);
    expect(pulse).toHaveBeenCalledTimes(2);
    feedback.release('left');
    expect(pulse).toHaveBeenLastCalledWith(0.6, 'center');
    feedback.dispose();
    pulse.mockClear();
    feedback.release('right');
    vi.advanceTimersByTime(1000);
    expect(pulse).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not queue ticks during robot rumble or resume until the stick moves', () => {
    const pulse = vi.fn();
    let rumbling = true;
    const feedback = new JoystickHapticFeedback(pulse, () => rumbling);
    feedback.move('left', 0.5, 0);
    expect(pulse).not.toHaveBeenCalled();
    rumbling = false;
    vi.advanceTimersByTime(1000);
    feedback.move('left', 0.5, 0);
    expect(pulse).not.toHaveBeenCalled();
    feedback.move('left', 0.7, 0);
    expect(pulse).toHaveBeenCalledTimes(1);
  });

  it('gives one immediate snap-back pulse with constant strength at any distance', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    feedback.move('left', 0.25, 0);
    feedback.release('left');
    expect(pulse).toHaveBeenLastCalledWith(0.6, 'center');
    const count = pulse.mock.calls.length;
    feedback.release('left');
    expect(pulse).toHaveBeenCalledTimes(count);
    feedback.move('right', 1, 0);
    feedback.release('right');
    expect(pulse).toHaveBeenLastCalledWith(0.6, 'center');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('keeps snap-back feedback silent during robot rumble', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse, () => true);
    feedback.move('left', 1, 0);
    feedback.release('left');
    expect(pulse).not.toHaveBeenCalled();
  });

  it('caps rapid pulses without scheduling delayed feedback', () => {
    const pulse = vi.fn();
    const feedback = new JoystickHapticFeedback(pulse);
    for (let i = 1; i <= 7; i++) {
      vi.advanceTimersByTime(10);
      feedback.move('left', i * 0.12, 0);
    }
    expect(pulse).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1000);
    expect(pulse).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });
});
