export const ROBOCOL_PORT = 20884;
export const ROBOCOL_VERSION = 124;
export const FTC_SDK_VERSION = '11.2';
export const STOP_OP_MODE = '$Stop$Robot$';

const HEADER_LENGTH = 5;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export enum RobocolMessageType {
  Heartbeat = 1,
  PeerDiscovery = 3,
  Command = 4,
  Telemetry = 5,
  KeepAlive = 6,
}

export enum RobotState {
  Unknown = -1,
  NotStarted = 0,
  Init = 1,
  Running = 2,
  Stopped = 3,
  EmergencyStop = 4,
}

export enum PeerType {
  Unset = 0,
  Peer = 1,
  GroupOwner = 2,
  NotConnectedDueToPreexistingConnection = 3,
}

export const DriverStationCommand = {
  InitOpMode: 'CMD_INIT_OP_MODE',
  RunOpMode: 'CMD_RUN_OP_MODE',
  RequestActiveConfig: 'CMD_REQUEST_ACTIVE_CONFIG',
  RequestParticularConfiguration: 'CMD_REQUEST_PARTICULAR_CONFIGURATION',
  RequestParticularConfigurationResp: 'CMD_REQUEST_PARTICULAR_CONFIGURATION_RESP',
  RequestOpModeList: 'CMD_REQUEST_OP_MODE_LIST',
  SaveConfiguration: 'CMD_SAVE_CONFIGURATION',
  RestartRobot: 'CMD_RESTART_ROBOT',
  NotifyActiveConfiguration: 'CMD_NOTIFY_ACTIVE_CONFIGURATION',
  NotifyOpModeList: 'CMD_NOTIFY_OP_MODE_LIST',
  NotifyInitOpMode: 'CMD_NOTIFY_INIT_OP_MODE',
  NotifyRunOpMode: 'CMD_NOTIFY_RUN_OP_MODE',
  ShowStacktrace: 'CMD_SHOW_STACKTRACE',
} as const;

export type DriverStationCommandName =
  (typeof DriverStationCommand)[keyof typeof DriverStationCommand];

export type PeerDiscoveryPacket = {
  type: RobocolMessageType.PeerDiscovery;
  sequence: number;
  robocolVersion: number;
  peerType: PeerType;
  sdkBuildMonth: number;
  sdkBuildYear: number;
  sdkMajorVersion: number;
  sdkMinorVersion: number;
};

export type HeartbeatPacket = {
  type: RobocolMessageType.Heartbeat;
  sequence: number;
  timestamp: bigint;
  robotState: RobotState;
  t0: bigint;
  t1: bigint;
  t2: bigint;
  timezoneId: string;
};

export type CommandPacket = {
  type: RobocolMessageType.Command;
  sequence: number;
  timestamp: bigint;
  acknowledged: boolean;
  name: string;
  extra: unknown;
};

export type TelemetryEntry = { key: string; value: string | number };

export type TelemetryPacket = {
  type: RobocolMessageType.Telemetry;
  sequence: number;
  timestamp: bigint;
  sorted: boolean;
  robotState: RobotState;
  tag: string;
  strings: TelemetryEntry[];
  numbers: TelemetryEntry[];
};

export type RobocolPacket =
  | PeerDiscoveryPacket
  | HeartbeatPacket
  | CommandPacket
  | TelemetryPacket;

function makePacket(type: RobocolMessageType, payloadLength: number, sequence: number) {
  const bytes = new Uint8Array(HEADER_LENGTH + payloadLength);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, type);
  view.setUint16(1, payloadLength, false);
  view.setUint16(3, sequence & 0xffff, false);
  return { bytes, view };
}

function setInt64(view: DataView, offset: number, value: bigint) {
  view.setBigInt64(offset, value, false);
}

function readString(bytes: Uint8Array, offset: number, length: number) {
  if (length < 0 || offset < 0 || offset + length > bytes.length) {
    throw new RangeError('String exceeds packet bounds');
  }
  return textDecoder.decode(bytes.subarray(offset, offset + length));
}

function parseJson(value: string): unknown {
  if (!value) return '';
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export function serializePeerDiscovery(sequence = 0): Uint8Array {
  const bytes = new Uint8Array(13);
  const view = new DataView(bytes.buffer);
  view.setUint8(0, RobocolMessageType.PeerDiscovery);
  view.setUint16(1, 10, false);
  view.setUint8(3, ROBOCOL_VERSION);
  view.setUint8(4, PeerType.Peer);
  view.setUint16(5, sequence & 0xffff, false);
  view.setUint8(7, 7);
  view.setUint16(8, 2026, false);
  view.setUint8(10, 11);
  view.setUint8(11, 2);
  return bytes;
}

export function serializeHeartbeat(sequence: number, now = Date.now()): Uint8Array {
  const timezone = textEncoder.encode(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  );
  const { bytes, view } = makePacket(
    RobocolMessageType.Heartbeat,
    34 + timezone.length,
    sequence
  );
  setInt64(view, 5, BigInt(now) * 1_000_000n);
  view.setUint8(13, RobotState.NotStarted);
  setInt64(view, 14, BigInt(now));
  setInt64(view, 22, 0n);
  setInt64(view, 30, 0n);
  view.setUint8(38, timezone.length);
  bytes.set(timezone, 39);
  return bytes;
}

export function serializeCommand({
  sequence,
  timestamp,
  name,
  extra = '',
  acknowledged = false,
}: {
  sequence: number;
  timestamp: bigint;
  name: string;
  extra?: unknown;
  acknowledged?: boolean;
}): Uint8Array {
  const nameBytes = textEncoder.encode(name);
  const extraText =
    typeof extra === 'string' ? extra : JSON.stringify(extra ?? '');
  const extraBytes = textEncoder.encode(extraText);
  const payloadLength = acknowledged
    ? 11 + nameBytes.length
    : 13 + nameBytes.length + extraBytes.length;
  const { bytes, view } = makePacket(
    RobocolMessageType.Command,
    payloadLength,
    sequence
  );
  setInt64(view, 5, timestamp);
  view.setUint8(13, acknowledged ? 1 : 0);
  view.setUint16(14, nameBytes.length, false);
  bytes.set(nameBytes, 16);
  if (!acknowledged) {
    const extraLengthOffset = 16 + nameBytes.length;
    view.setUint16(extraLengthOffset, extraBytes.length, false);
    bytes.set(extraBytes, extraLengthOffset + 2);
  }
  return bytes;
}

export function parseRobocolPacket(bytes: Uint8Array): RobocolPacket | null {
  if (bytes.length < HEADER_LENGTH) return null;

  try {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const type = view.getUint8(0) as RobocolMessageType;

    if (type === RobocolMessageType.PeerDiscovery) {
      if (bytes.length < 13) return null;
      return {
        type,
        robocolVersion: view.getUint8(3),
        peerType: view.getUint8(4) as PeerType,
        sequence: view.getUint16(5, false),
        sdkBuildMonth: view.getUint8(7),
        sdkBuildYear: view.getUint16(8, false),
        sdkMajorVersion: view.getUint8(10),
        sdkMinorVersion: view.getUint8(11),
      };
    }

    const payloadLength = view.getUint16(1, false);
    if (bytes.length < HEADER_LENGTH + payloadLength) return null;
    const sequence = view.getUint16(3, false);

    if (type === RobocolMessageType.Heartbeat) {
      if (payloadLength < 34) return null;
      const timezoneLength = view.getUint8(38);
      return {
        type,
        sequence,
        timestamp: view.getBigInt64(5, false),
        robotState: view.getUint8(13) as RobotState,
        t0: view.getBigInt64(14, false),
        t1: view.getBigInt64(22, false),
        t2: view.getBigInt64(30, false),
        timezoneId: readString(bytes, 39, timezoneLength),
      };
    }

    if (type === RobocolMessageType.Command) {
      if (payloadLength < 11) return null;
      const acknowledged = view.getUint8(13) !== 0;
      const nameLength = view.getUint16(14, false);
      const name = readString(bytes, 16, nameLength);
      let extra: unknown = '';
      if (!acknowledged) {
        const extraLengthOffset = 16 + nameLength;
        if (extraLengthOffset + 2 > bytes.length) return null;
        const extraLength = view.getUint16(extraLengthOffset, false);
        extra = parseJson(readString(bytes, extraLengthOffset + 2, extraLength));
      }
      return {
        type,
        sequence,
        timestamp: view.getBigInt64(5, false),
        acknowledged,
        name,
        extra,
      };
    }

    if (type === RobocolMessageType.Telemetry) {
      if (payloadLength < 13) return null;
      let offset = 16;
      const tagLength = view.getUint8(15);
      const tag = readString(bytes, offset, tagLength);
      offset += tagLength;

      const strings: TelemetryEntry[] = [];
      const stringCount = view.getUint8(offset++);
      for (let index = 0; index < stringCount; index += 1) {
        const keyLength = view.getUint16(offset, false);
        offset += 2;
        const key = readString(bytes, offset, keyLength);
        offset += keyLength;
        const valueLength = view.getUint16(offset, false);
        offset += 2;
        const value = readString(bytes, offset, valueLength);
        offset += valueLength;
        strings.push({ key, value });
      }

      const numbers: TelemetryEntry[] = [];
      const numberCount = view.getUint8(offset++);
      for (let index = 0; index < numberCount; index += 1) {
        const keyLength = view.getUint16(offset, false);
        offset += 2;
        const key = readString(bytes, offset, keyLength);
        offset += keyLength;
        const value = view.getFloat32(offset, false);
        offset += 4;
        numbers.push({ key, value });
      }

      return {
        type,
        sequence,
        timestamp: view.getBigInt64(5, false),
        sorted: view.getUint8(13) !== 0,
        robotState: view.getUint8(14) as RobotState,
        tag,
        strings,
        numbers,
      };
    }
  } catch {
    return null;
  }

  return null;
}
