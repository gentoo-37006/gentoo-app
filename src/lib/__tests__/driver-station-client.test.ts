import { describe, expect, it, vi } from 'vitest';
import { bytesToBase64, base64ToBytes } from '../driver-station/base64';
import { DriverStationClient } from '../driver-station/client';
import {
  DriverStationCommand,
  RobocolMessageType,
  parseRobocolPacket,
  serializeCommand,
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
  it('connects to a Control Hub and accepts an OpMode list', async () => {
    vi.useFakeTimers();
    const fake = createTransport();
    const client = new DriverStationClient(fake.transport);
    await client.start();

    fake.receive(serializePeerDiscovery(1));
    expect(client.getSnapshot()).toMatchObject({
      status: 'connected',
      peerHost: '192.168.43.1',
      sdkVersion: '11.2',
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
