import { describe, expect, it, vi } from 'vitest';
import { bytesToBase64, base64ToBytes } from '../driver-station/base64';
import { DriverStationClient } from '../driver-station/client';
import {
  DriverStationCommand,
  RobocolMessageType,
  parseRobocolPacket,
  serializeCommand,
  serializeHeartbeat,
  serializePeerDiscovery,
} from '../driver-station/protocol';
import type { DriverStationTransport } from '../driver-station/transport';

function createTransport() {
  let datagramListener: ((event: { data: string; host: string; port: number }) => void) | null = null;
  const sent: { data: string; host: string; port: number }[] = [];
  const transport: DriverStationTransport = {
    available: true,
    start: vi.fn(async () => undefined),
    stop: vi.fn(async () => undefined),
    send: vi.fn(async (data, host, port) => {
      sent.push({ data, host, port });
    }),
    onDatagram(listener) {
      datagramListener = listener;
      return { remove: () => { datagramListener = null; } };
    },
    onError: () => ({ remove: () => undefined }),
  };
  return {
    transport,
    sent,
    receive(bytes: Uint8Array, host = '192.168.43.1') {
      datagramListener?.({ data: bytesToBase64(bytes), host, port: 20884 });
    },
  };
}

describe('DriverStationClient', () => {
  it('does not send or retain controller input entered offline', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      const client = new DriverStationClient(fake.transport);
      await client.start();
      client.setControllerEnabled(true);
      client.updateGamepad({ leftStickX: 1, buttons: 0x100 });
      await vi.advanceTimersByTimeAsync(100);
      expect(fake.sent.some((item) => base64ToBytes(item.data)[0] === RobocolMessageType.Gamepad)).toBe(false);
      fake.receive(serializeHeartbeat(1));
      fake.receive(serializeCommand({ sequence: 2, timestamp: 2n, name: DriverStationCommand.NotifyRunOpMode, extra: 'TeleOp' }));
      await vi.advanceTimersByTimeAsync(50);
      const gamepads = fake.sent.map((item) => base64ToBytes(item.data)).filter((item) => item[0] === RobocolMessageType.Gamepad);
      expect(gamepads.length).toBeGreaterThan(0);
      expect(gamepads.every((bytes) => new DataView(bytes.buffer).getFloat32(18) === 0 && new DataView(bytes.buffer).getUint32(42) === 0)).toBe(true);
      client.disconnect();
      await vi.runAllTimersAsync();
    } finally { vi.useRealTimers(); }
  });

  it('routes rumble to the selected gamepad, acknowledges retries without replaying, and cancels on stop', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      const client = new DriverStationClient(fake.transport);
      const rumble = vi.fn();
      client.subscribeRumble(rumble);
      await client.start();
      fake.receive(serializeHeartbeat(1));
      fake.receive(serializeCommand({ sequence: 2, timestamp: 2n, name: DriverStationCommand.NotifyRunOpMode, extra: 'TeleOp' }));
      const effect = { user: 1, steps: [{ large: 255, small: 64, duration: 250 }] };
      const packet = serializeCommand({ sequence: 3, timestamp: 3n, name: DriverStationCommand.RumbleGamepad, extra: effect });
      fake.receive(packet);
      fake.receive(packet);
      expect(rumble).toHaveBeenCalledTimes(1);
      expect(rumble).toHaveBeenLastCalledWith(effect);
      const acknowledgements = fake.sent.map((item) => parseRobocolPacket(base64ToBytes(item.data)))
        .filter((item) => item?.type === RobocolMessageType.Command && item.name === DriverStationCommand.RumbleGamepad);
      expect(acknowledgements).toHaveLength(2);
      client.setGamepadUser(2);
      expect(rumble).toHaveBeenLastCalledWith(null);
      rumble.mockClear();
      fake.receive(serializeCommand({ sequence: 4, timestamp: 4n, name: DriverStationCommand.RumbleGamepad, extra: effect }));
      expect(rumble).not.toHaveBeenCalled();
      fake.receive(serializeCommand({ sequence: 5, timestamp: 5n, name: DriverStationCommand.RumbleGamepad, extra: { ...effect, user: 2 } }));
      expect(rumble).toHaveBeenLastCalledWith({ ...effect, user: 2 });
      client.stopOpMode();
      expect(rumble).toHaveBeenLastCalledWith(null);
      client.disconnect();
      await vi.runAllTimersAsync();
    } finally { vi.useRealTimers(); }
  });

  it('does not create a polling timer after disconnecting during startup', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      let finishStart!: () => void;
      fake.transport.start = vi.fn(() => new Promise<void>((resolve) => { finishStart = resolve; }));
      const client = new DriverStationClient(fake.transport);
      const starting = client.start();
      client.disconnect();
      finishStart();
      await starting;
      await vi.advanceTimersByTimeAsync(1000);
      expect(fake.sent).toHaveLength(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(fake.transport.stop).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

  it('ignores an obsolete startup completion after an immediate restart', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      let finishOldStart!: () => void;
      fake.transport.start = vi.fn<DriverStationTransport['start']>()
        .mockImplementationOnce(() => new Promise<void>((resolve) => { finishOldStart = resolve; }))
        .mockResolvedValue(undefined);
      const client = new DriverStationClient(fake.transport);
      const oldStart = client.start();
      client.disconnect();
      await client.start();
      finishOldStart();
      await oldStart;
      expect(vi.getTimerCount()).toBe(1);
      client.disconnect();
      await vi.runAllTimersAsync();
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('does not let an alternate-address probe failure overwrite a connected Hub', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      fake.transport.send = vi.fn(async (_data, host) => {
        if (host === '192.168.49.1') throw new Error('No route to alternate Hub');
      });
      const client = new DriverStationClient(fake.transport);
      await client.start();
      fake.receive(serializeHeartbeat(1));
      await vi.advanceTimersByTimeAsync(0);
      expect(client.getSnapshot().status).toBe('connected');
      client.disconnect();
      await vi.runAllTimersAsync();
    } finally { vi.useRealTimers(); }
  });

  it('recovers connection status after a transient send failure', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      const client = new DriverStationClient(fake.transport);
      await client.start();
      fake.receive(serializeHeartbeat(1));
      fake.transport.send = vi.fn(async () => { throw new Error('Wi-Fi temporarily unavailable'); });
      await vi.advanceTimersByTimeAsync(100);
      expect(client.getSnapshot().status).toBe('error');
      fake.receive(serializeHeartbeat(2));
      expect(client.getSnapshot().status).toBe('connected');
      client.disconnect();
      await vi.runAllTimersAsync();
    } finally { vi.useRealTimers(); }
  });

  it('streams controller input and clears it on stop, view exit, and connection loss', async () => {
    vi.useFakeTimers();
    try {
      const fake = createTransport();
      const client = new DriverStationClient(fake.transport);
      await client.start();
      fake.receive(serializeHeartbeat(1));
      fake.receive(serializeCommand({ sequence: 2, timestamp: 2n, name: DriverStationCommand.NotifyRunOpMode, extra: 'Main TeleOp' }));
      const gamepads = () => fake.sent.map((item) => base64ToBytes(item.data)).filter((bytes) => bytes[0] === RobocolMessageType.Gamepad);
      const lastX = (user = 1) => new DataView(gamepads().filter((bytes) => bytes[46] === user).at(-1)!.buffer).getFloat32(18);
      client.setControllerEnabled(true);
      client.updateGamepad({ leftStickX: 0.5 });
      await vi.advanceTimersByTimeAsync(100);
      expect(lastX()).toBe(0.5);
      client.setGamepadUser(2);
      expect(lastX()).toBe(0);
      expect(lastX(2)).toBe(0);
      client.updateGamepad({ leftStickX: 0.75 });
      await vi.advanceTimersByTimeAsync(50);
      expect(lastX()).toBe(0);
      expect(lastX(2)).toBe(0.75);
      client.stopOpMode();
      expect(lastX()).toBe(0);
      expect(lastX(2)).toBe(0);
      client.updateGamepad({ leftStickX: 1 });
      await vi.advanceTimersByTimeAsync(100);
      expect(lastX()).toBe(0);
      expect(lastX(2)).toBe(0);
      client.setControllerEnabled(false);
      expect(lastX()).toBe(0);
      const count = gamepads().length;
      await vi.advanceTimersByTimeAsync(100);
      expect(gamepads().length).toBeGreaterThan(count);
      expect(lastX()).toBe(0);
      client.setControllerEnabled(true);
      client.updateGamepad({ leftStickX: 1 });
      await vi.advanceTimersByTimeAsync(2100);
      expect(client.getSnapshot().status).toBe('discovering');
      fake.receive(serializeHeartbeat(3));
      await vi.advanceTimersByTimeAsync(50);
      expect(lastX()).toBe(0);
      client.disconnect();
      await vi.runAllTimersAsync();
    } finally {
      vi.useRealTimers();
    }
  });

  it('connects from a heartbeat without requiring a discovery reply', async () => {
    vi.useFakeTimers();
    const fake = createTransport();
    const client = new DriverStationClient(fake.transport);
    await client.start();

    fake.receive(serializeHeartbeat(4, Date.now()));

    expect(client.getSnapshot()).toMatchObject({
      status: 'connected',
      peerHost: '192.168.43.1',
    });
    const outboundNames = fake.sent
      .map((item) => parseRobocolPacket(base64ToBytes(item.data)))
      .filter((packet) => packet?.type === RobocolMessageType.Command)
      .map((packet) => packet.name);
    expect(outboundNames).toContain(DriverStationCommand.RequestActiveConfig);
    expect(outboundNames).toContain(DriverStationCommand.RequestOpModeList);

    client.disconnect();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('does not adopt Robocol traffic from an unknown host', async () => {
    vi.useFakeTimers();
    const fake = createTransport();
    const client = new DriverStationClient(fake.transport);
    await client.start();

    fake.receive(serializeHeartbeat(4, Date.now()), '192.168.43.99');
    expect(client.getSnapshot().status).toBe('discovering');

    client.disconnect();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });

  it('connects to a Control Hub and accepts an OpMode list', async () => {
    vi.useFakeTimers();
    const fake = createTransport();
    const client = new DriverStationClient(fake.transport);
    await client.start();

    fake.receive(serializePeerDiscovery(1));
    expect(client.getSnapshot()).toMatchObject({
      status: 'connected',
      peerHost: '192.168.43.1',
      sdkVersion: '12.0',
    });

    const outboundNames = fake.sent
      .map((item) => parseRobocolPacket(base64ToBytes(item.data)))
      .filter((packet) => packet?.type === RobocolMessageType.Command)
      .map((packet) => packet.name);
    expect(outboundNames).toContain(DriverStationCommand.RequestActiveConfig);
    expect(outboundNames).toContain(DriverStationCommand.RequestOpModeList);

    fake.receive(
      serializeCommand({
        sequence: 12,
        timestamp: 200n,
        name: DriverStationCommand.NotifyOpModeList,
        extra: [
          { name: 'Main TeleOp', flavor: 'TELEOP', group: 'Competition' },
          { name: 'Auto Left', flavor: 'AUTONOMOUS', group: 'Competition' },
        ],
      })
    );
    expect(client.getSnapshot().opModes.map((opMode) => opMode.name)).toEqual([
      'Auto Left',
      'Main TeleOp',
    ]);

    const lastPacket = parseRobocolPacket(base64ToBytes(fake.sent.at(-1)!.data));
    expect(lastPacket).toMatchObject({
      type: RobocolMessageType.Command,
      acknowledged: true,
      name: DriverStationCommand.NotifyOpModeList,
      timestamp: 200n,
    });

    client.disconnect();
    await vi.runAllTimersAsync();
    vi.useRealTimers();
  });
});
