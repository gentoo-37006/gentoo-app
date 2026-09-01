import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '../driver-station/base64';
import {
  DriverStationCommand,
  PeerType,
  ROBOCOL_VERSION,
  RobocolMessageType,
  RobotState,
  parseRobocolPacket,
  serializeCommand,
  serializeHeartbeat,
  serializePeerDiscovery,
} from '../driver-station/protocol';

describe('Driver Station Robocol packets', () => {
  it('serializes FTC SDK 11.2 peer discovery metadata', () => {
    const bytes = serializePeerDiscovery(42);
    const packet = parseRobocolPacket(bytes);
    expect(packet).toEqual({
      type: RobocolMessageType.PeerDiscovery,
      robocolVersion: ROBOCOL_VERSION,
      peerType: PeerType.Peer,
      sequence: 42,
      sdkBuildMonth: 7,
      sdkBuildYear: 2026,
      sdkMajorVersion: 11,
      sdkMinorVersion: 2,
    });
  });

  it('round-trips commands and acknowledgements', () => {
    const command = serializeCommand({
      sequence: 7,
      timestamp: 123456n,
      name: DriverStationCommand.InitOpMode,
      extra: 'TeleOp',
    });
    expect(parseRobocolPacket(command)).toMatchObject({
      type: RobocolMessageType.Command,
      sequence: 7,
      timestamp: 123456n,
      acknowledged: false,
      name: DriverStationCommand.InitOpMode,
      extra: 'TeleOp',
    });

    const acknowledgement = serializeCommand({
      sequence: 7,
      timestamp: 123456n,
      name: DriverStationCommand.InitOpMode,
      acknowledged: true,
    });
    expect(parseRobocolPacket(acknowledgement)).toMatchObject({
      acknowledged: true,
      name: DriverStationCommand.InitOpMode,
      timestamp: 123456n,
    });
  });

  it('uses the official heartbeat offsets', () => {
    const packet = parseRobocolPacket(serializeHeartbeat(9, 1_700_000_000_000));
    expect(packet).toMatchObject({
      type: RobocolMessageType.Heartbeat,
      sequence: 9,
      robotState: RobotState.NotStarted,
      t0: 1_700_000_000_000n,
      t1: 0n,
      t2: 0n,
    });
  });

  it('round-trips binary datagrams through the native base64 boundary', () => {
    const bytes = new Uint8Array([0, 1, 2, 127, 128, 254, 255]);
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
  });

  it('rejects truncated packets', () => {
    expect(parseRobocolPacket(new Uint8Array([4, 0, 20, 0, 1, 2]))).toBeNull();
  });
});
