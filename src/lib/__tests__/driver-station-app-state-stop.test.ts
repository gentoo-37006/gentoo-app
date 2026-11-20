import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppStateStop, INACTIVE_STOP_DELAY_MS } from '../driver-station/app-state-stop';

function fakeClient() {
  return { setControllerEnabled: vi.fn(), stopOpMode: vi.fn() };
}

describe('stopping the OpMode when the app leaves the foreground', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('stops at once when the app is backgrounded', () => {
    const client = fakeClient();
    createAppStateStop(client).handle('background');
    expect(client.setControllerEnabled).toHaveBeenCalledWith(false);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it('keeps the OpMode running through a brief inactive state, such as a screenshot', () => {
    const client = fakeClient();
    const stop = createAppStateStop(client);
    stop.handle('inactive');
    expect(client.setControllerEnabled).toHaveBeenCalledWith(false);
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS - 1);
    stop.handle('active');
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS * 2);
    expect(client.stopOpMode).not.toHaveBeenCalled();
  });

  it('stops when the app stays inactive past the delay', () => {
    const client = fakeClient();
    createAppStateStop(client).handle('inactive');
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS - 1);
    expect(client.stopOpMode).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it('does not extend the wait when inactive is reported again', () => {
    const client = fakeClient();
    const stop = createAppStateStop(client);
    stop.handle('inactive');
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS - 500);
    stop.handle('inactive');
    vi.advanceTimersByTime(500);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it('stops once when inactive turns into background, as it does on the way out', () => {
    const client = fakeClient();
    const stop = createAppStateStop(client);
    stop.handle('inactive');
    stop.handle('background');
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS * 2);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it('starts a fresh wait each time the app becomes inactive again', () => {
    const client = fakeClient();
    const stop = createAppStateStop(client);
    stop.handle('inactive');
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS - 1);
    stop.handle('active');
    stop.handle('inactive');
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS - 1);
    expect(client.stopOpMode).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it.each(['unknown', 'extension'] as const)('treats %s like backgrounding', (state) => {
    const client = fakeClient();
    createAppStateStop(client).handle(state);
    expect(client.stopOpMode).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending stop when disposed', () => {
    const client = fakeClient();
    const stop = createAppStateStop(client);
    stop.handle('inactive');
    stop.dispose();
    vi.advanceTimersByTime(INACTIVE_STOP_DELAY_MS * 2);
    expect(client.stopOpMode).not.toHaveBeenCalled();
  });

  it('does nothing when the app becomes active with no stop pending', () => {
    const client = fakeClient();
    createAppStateStop(client).handle('active');
    expect(client.setControllerEnabled).not.toHaveBeenCalled();
    expect(client.stopOpMode).not.toHaveBeenCalled();
  });
});
