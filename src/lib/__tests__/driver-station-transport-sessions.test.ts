import { describe, expect, it, vi } from 'vitest';
import { createTransportSessions } from '../driver-station/transport-sessions';
import type { DriverStationTransport } from '../driver-station/transport';

function nativeTransport() {
  const operations: string[] = [];
  const native: DriverStationTransport = {
    available: true,
    start: vi.fn(async () => { operations.push('start'); }),
    stop: vi.fn(async () => { operations.push('stop'); }),
    send: vi.fn(async (data) => { operations.push(data); }),
    onDatagram: () => null,
    onError: () => null,
  };
  return { native, operations, create: createTransportSessions(native) };
}

describe('Driver Station socket sessions', () => {
  it('prevents a retired page from closing or sending through its replacement socket', async () => {
    const { native, create } = nativeTransport();
    const previous = create();
    const current = create();
    await previous.start(20884);
    await current.start(20884);
    await previous.stop();
    await previous.send('stale', '192.168.43.1', 20884);
    expect(native.stop).not.toHaveBeenCalled();
    expect(native.send).not.toHaveBeenCalled();
    await current.send('current', '192.168.43.1', 20884);
    expect(native.send).toHaveBeenCalledWith('current', '192.168.43.1', 20884);
    await current.stop();
    expect(native.stop).toHaveBeenCalledTimes(1);
  });

  it('sends the final stop packet before closing and opening a replacement', async () => {
    const { create, operations } = nativeTransport();
    const previous = create();
    const current = create();
    await previous.start(20884);
    const send = previous.send('robot-stop', '192.168.43.1', 20884);
    const close = previous.stop();
    const open = current.start(20884);
    await Promise.all([send, close, open]);
    expect(operations).toEqual(['start', 'robot-stop', 'stop', 'start']);
  });

  it('supports immediate start-cleanup-start on the same session', async () => {
    const { create, operations } = nativeTransport();
    const session = create();
    await session.start(20884);
    const close = session.stop();
    const open = session.start(20884);
    await Promise.all([close, open]);
    await session.send('current', '192.168.43.1', 20884);
    expect(operations).toEqual(['start', 'stop', 'start', 'current']);
  });

  it('cancels startup queued for an already closed page', async () => {
    const { native, create } = nativeTransport();
    const session = create();
    const start = session.start(20884);
    const stop = session.stop();
    await Promise.all([start, stop]);
    expect(native.start).not.toHaveBeenCalled();
    expect(native.stop).not.toHaveBeenCalled();
  });
});
