import { base64ToBytes, bytesToBase64 } from './base64';
import {
  DriverStationCommand,
  FTC_SDK_VERSION,
  PeerType,
  ROBOCOL_PORT,
  ROBOCOL_VERSION,
  RobocolMessageType,
  RobotState,
  STOP_OP_MODE,
  parseRobocolPacket,
  serializeCommand,
  serializeHeartbeat,
  serializePeerDiscovery,
  type CommandPacket,
  type TelemetryEntry,
} from './protocol';
import type { DriverStationTransport, RemoveListener } from './transport';

const CONTROL_HUB_ADDRESSES = ['192.168.43.1', '192.168.49.1'];
const DISCOVERY_INTERVAL_MS = 200;
const CONNECTION_TIMEOUT_MS = 2_000;
const COMMAND_RETRY_MS = 100;
const MAX_COMMAND_ATTEMPTS = 10;

const SYSTEM_NONE = '$System$None$';
const SYSTEM_WARNING = '$System$Warning$';
const SYSTEM_ERROR = '$System$Error$';
const BATTERY_KEY = '$Robot$Battery$Level$';
const NO_VOLTAGE_SENSOR = '$no$voltage$sensor$';

export type ConnectionStatus =
  | 'unavailable'
  | 'starting'
  | 'discovering'
  | 'connected'
  | 'error';

export type OpModeFlavor = 'AUTONOMOUS' | 'TELEOP' | 'UTILITY' | 'SYSTEM' | string;

export type OpMode = {
  name: string;
  flavor: OpModeFlavor;
  group: string;
  source?: string;
};

export type HardwareConfigurationMeta = {
  name: string;
  location: string;
  isDirty: boolean;
  resourceId?: number;
};

export type DriverStationSnapshot = {
  status: ConnectionStatus;
  statusMessage: string;
  peerHost: string | null;
  robotState: RobotState;
  latencyMs: number | null;
  lastPacketAt: number | null;
  sdkVersion: string | null;
  opModes: OpMode[];
  activeOpMode: string;
  opModePhase: 'stopped' | 'init' | 'running';
  telemetry: TelemetryEntry[];
  warning: string | null;
  error: string | null;
  batteryVoltage: number | null;
  activeConfiguration: HardwareConfigurationMeta | null;
  hardwareXml: string | null;
  configurationSaving: boolean;
  configurationMessage: string | null;
};

type PendingCommand = {
  packet: Uint8Array;
  name: string;
  timestamp: bigint;
  attempts: number;
  lastSentAt: number;
};

const initialSnapshot: DriverStationSnapshot = {
  status: 'starting',
  statusMessage: 'Starting local network transport...',
  peerHost: null,
  robotState: RobotState.Unknown,
  latencyMs: null,
  lastPacketAt: null,
  sdkVersion: null,
  opModes: [],
  activeOpMode: STOP_OP_MODE,
  opModePhase: 'stopped',
  telemetry: [],
  warning: null,
  error: null,
  batteryVoltage: null,
  activeConfiguration: null,
  hardwareXml: null,
  configurationSaving: false,
  configurationMessage: null,
};

function isOpMode(value: unknown): value is OpMode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OpMode>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.flavor === 'string' &&
    typeof candidate.group === 'string'
  );
}

function isConfigurationMeta(value: unknown): value is HardwareConfigurationMeta {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<HardwareConfigurationMeta>;
  return typeof candidate.name === 'string' && typeof candidate.location === 'string';
}

function systemMessage(packet: { strings: TelemetryEntry[]; tag: string }) {
  const tagged = packet.strings.find((entry) => entry.key === packet.tag)?.value;
  if (tagged !== undefined) return String(tagged);
  return packet.strings.map((entry) => String(entry.value)).join('\n');
}

export class DriverStationClient {
  private snapshot: DriverStationSnapshot;
  private listeners = new Set<(snapshot: DriverStationSnapshot) => void>();
  private subscriptions: RemoveListener[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private sequence = 0;
  private commandTimestamp = BigInt(Date.now()) * 1_000_000n;
  private pendingCommands = new Map<string, PendingCommand>();
  private remoteHost: string | null = null;
  private lastHeartbeatAt = 0;
  private lastHeartbeatSentAt = 0;
  private lastDiscoveryAt = 0;
  private running = false;

  constructor(private readonly transport: DriverStationTransport) {
    this.snapshot = {
      ...initialSnapshot,
      status: transport.available ? 'starting' : 'unavailable',
      statusMessage: transport.available
        ? initialSnapshot.statusMessage
        : 'Rebuild the Gentoo mobile app to install the Driver Station transport.',
    };
  }

  getSnapshot = () => this.snapshot;

  subscribe = (listener: (snapshot: DriverStationSnapshot) => void) => {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  };

  async start() {
    if (this.running || !this.transport.available) return;
    this.running = true;
    const datagramSubscription = this.transport.onDatagram((event) => {
      this.handleDatagram(base64ToBytes(event.data), event.host);
    });
    const errorSubscription = this.transport.onError((message) => {
      this.update({ status: 'error', statusMessage: message });
    });
    if (datagramSubscription) this.subscriptions.push(datagramSubscription);
    if (errorSubscription) this.subscriptions.push(errorSubscription);

    try {
      await this.transport.start(ROBOCOL_PORT);
      this.update({ status: 'discovering', statusMessage: 'Looking for a REV Control Hub...' });
      this.timer = setInterval(() => this.tick(), 50);
      this.tick();
    } catch (error) {
      this.running = false;
      this.update({
        status: 'error',
        statusMessage: error instanceof Error ? error.message : 'Unable to start Driver Station networking.',
      });
    }
  }

  disconnect() {
    if (!this.running) return;
    if (this.remoteHost && this.snapshot.activeOpMode !== STOP_OP_MODE) {
      this.sendCommand(DriverStationCommand.InitOpMode, STOP_OP_MODE);
    }
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.subscriptions.forEach((subscription) => subscription.remove());
    this.subscriptions = [];
    setTimeout(() => void this.transport.stop(), 150);
  }

  initOpMode(name: string) {
    if (!this.snapshot.opModes.some((opMode) => opMode.name === name)) return;
    this.sendCommand(DriverStationCommand.InitOpMode, name);
  }

  startOpMode(name: string) {
    if (this.snapshot.activeOpMode !== name || this.snapshot.opModePhase !== 'init') return;
    this.sendCommand(DriverStationCommand.RunOpMode, name);
  }

  stopOpMode() {
    this.sendCommand(DriverStationCommand.InitOpMode, STOP_OP_MODE);
  }

  restartRobot() {
    if (this.snapshot.activeOpMode !== STOP_OP_MODE) return;
    this.sendCommand(DriverStationCommand.RestartRobot);
    this.update({ configurationMessage: 'Restart requested. Waiting for the Control Hub...' });
  }

  requestHardwareConfiguration() {
    const configuration = this.snapshot.activeConfiguration;
    if (!configuration) return;
    this.update({ hardwareXml: null, configurationMessage: 'Loading hardware configuration...' });
    this.sendCommand(DriverStationCommand.RequestParticularConfiguration, configuration);
  }

  saveHardwareConfiguration(xml: string) {
    const configuration = this.snapshot.activeConfiguration;
    if (!configuration) return;
    const metadata = { ...configuration, isDirty: true };
    this.update({ configurationSaving: true, configurationMessage: 'Saving hardware names...' });
    this.sendCommand(
      DriverStationCommand.SaveConfiguration,
      `${JSON.stringify(metadata)};${xml}`
    );
  }

  private update(patch: Partial<DriverStationSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((listener) => listener(this.snapshot));
  }

  private nextSequence() {
    this.sequence = (this.sequence + 1) & 0xffff;
    return this.sequence;
  }

  private nextCommandTimestamp() {
    this.commandTimestamp += 1n;
    return this.commandTimestamp;
  }

  private sendRaw(packet: Uint8Array, host: string) {
    void this.transport
      .send(bytesToBase64(packet), host, ROBOCOL_PORT)
      .catch((error) => {
        this.update({
          status: 'error',
          statusMessage: error instanceof Error ? error.message : 'Unable to send to the Control Hub.',
        });
      });
  }

  private sendCommand(name: string, extra: unknown = '') {
    if (!this.remoteHost) return;
    const timestamp = this.nextCommandTimestamp();
    const packet = serializeCommand({
      sequence: this.nextSequence(),
      timestamp,
      name,
      extra,
    });
    const pending: PendingCommand = {
      packet,
      name,
      timestamp,
      attempts: 1,
      lastSentAt: Date.now(),
    };
    this.pendingCommands.set(`${name}:${timestamp}`, pending);
    this.sendRaw(packet, this.remoteHost);
  }

  private tick() {
    if (!this.running) return;
    const now = Date.now();

    if (this.remoteHost && now - this.lastHeartbeatAt > CONNECTION_TIMEOUT_MS) {
      this.remoteHost = null;
      this.sequence = 0;
      this.pendingCommands.clear();
      this.update({
        status: 'discovering',
        statusMessage: 'Control Hub connection lost. Reconnecting...',
        peerHost: null,
        robotState: RobotState.Unknown,
        latencyMs: null,
        opModes: [],
        activeOpMode: STOP_OP_MODE,
        opModePhase: 'stopped',
        batteryVoltage: null,
        activeConfiguration: null,
        hardwareXml: null,
      });
    }

    if (!this.remoteHost && now - this.lastDiscoveryAt >= DISCOVERY_INTERVAL_MS) {
      this.lastDiscoveryAt = now;
      const discovery = serializePeerDiscovery(this.nextSequence());
      CONTROL_HUB_ADDRESSES.forEach((host) => this.sendRaw(discovery, host));
    } else if (
      this.remoteHost &&
      now - this.lastHeartbeatSentAt >= DISCOVERY_INTERVAL_MS
    ) {
      this.lastHeartbeatSentAt = now;
      this.sendRaw(serializeHeartbeat(this.nextSequence(), now), this.remoteHost);
    }

    for (const [key, pending] of this.pendingCommands) {
      if (now - pending.lastSentAt < COMMAND_RETRY_MS) continue;
      if (pending.attempts >= MAX_COMMAND_ATTEMPTS) {
        this.pendingCommands.delete(key);
        if (pending.name === DriverStationCommand.SaveConfiguration) {
          this.update({
            configurationSaving: false,
            configurationMessage: 'The Control Hub did not confirm the configuration save.',
          });
        }
        continue;
      }
      pending.attempts += 1;
      pending.lastSentAt = now;
      if (this.remoteHost) this.sendRaw(pending.packet, this.remoteHost);
    }
  }

  private handleDatagram(bytes: Uint8Array, host: string) {
    const packet = parseRobocolPacket(bytes);
    if (!packet) return;
    const now = Date.now();

    if (packet.type === RobocolMessageType.PeerDiscovery) {
      if (packet.robocolVersion !== ROBOCOL_VERSION) {
        this.update({
          status: 'error',
          statusMessage: `Robocol ${packet.robocolVersion} is not compatible with Gentoo ${ROBOCOL_VERSION}.`,
          sdkVersion: `${packet.sdkMajorVersion}.${packet.sdkMinorVersion}`,
        });
        return;
      }
      if (packet.peerType === PeerType.NotConnectedDueToPreexistingConnection) {
        this.update({
          status: 'error',
          statusMessage: 'The Control Hub is already connected to another Driver Station.',
        });
        return;
      }
      if (packet.peerType !== PeerType.Peer) return;
      if (!this.remoteHost) {
        this.remoteHost = host;
        this.sequence = 0;
        this.lastHeartbeatAt = now;
        this.update({
          status: 'connected',
          statusMessage: 'Connected',
          peerHost: host,
          lastPacketAt: now,
          sdkVersion: `${packet.sdkMajorVersion}.${packet.sdkMinorVersion}`,
        });
        this.sendCommand(DriverStationCommand.RequestActiveConfig);
        this.sendCommand(DriverStationCommand.RequestOpModeList);
      }
      return;
    }

    if (host !== this.remoteHost) return;
    this.lastHeartbeatAt = now;
    this.update({ lastPacketAt: now });

    if (packet.type === RobocolMessageType.Heartbeat) {
      const latency = packet.t0 > 0n ? Math.max(0, now - Number(packet.t0)) : null;
      this.update({
        robotState: packet.robotState,
        latencyMs: latency !== null && latency < 10_000 ? latency : this.snapshot.latencyMs,
      });
      return;
    }

    if (packet.type === RobocolMessageType.Telemetry) {
      this.handleTelemetry(packet);
      return;
    }

    if (packet.type === RobocolMessageType.Command) {
      this.handleCommand(packet);
    }
  }

  private acknowledge(packet: CommandPacket) {
    if (!this.remoteHost) return;
    this.sendRaw(
      serializeCommand({
        sequence: packet.sequence,
        timestamp: packet.timestamp,
        name: packet.name,
        acknowledged: true,
      }),
      this.remoteHost
    );
  }

  private handleCommand(packet: CommandPacket) {
    if (packet.acknowledged) {
      const key = `${packet.name}:${packet.timestamp}`;
      if (!this.pendingCommands.delete(key)) return;
      if (packet.name === DriverStationCommand.SaveConfiguration) {
        this.update({
          configurationSaving: false,
          configurationMessage: 'Hardware names saved. Restart the robot to apply them.',
        });
      }
      return;
    }

    this.acknowledge(packet);
    switch (packet.name) {
      case DriverStationCommand.NotifyOpModeList: {
        const opModes = Array.isArray(packet.extra)
          ? packet.extra.filter(isOpMode).sort((a, b) =>
              a.flavor.localeCompare(b.flavor) ||
              a.group.localeCompare(b.group) ||
              a.name.localeCompare(b.name)
            )
          : [];
        this.update({ opModes });
        break;
      }
      case DriverStationCommand.NotifyInitOpMode: {
        const activeOpMode = typeof packet.extra === 'string' ? packet.extra : STOP_OP_MODE;
        this.update({
          activeOpMode,
          opModePhase: activeOpMode === STOP_OP_MODE ? 'stopped' : 'init',
        });
        break;
      }
      case DriverStationCommand.NotifyRunOpMode:
        this.update({
          activeOpMode: typeof packet.extra === 'string' ? packet.extra : STOP_OP_MODE,
          opModePhase: 'running',
        });
        break;
      case DriverStationCommand.NotifyActiveConfiguration:
        if (isConfigurationMeta(packet.extra)) {
          this.update({ activeConfiguration: packet.extra, hardwareXml: null });
          this.sendCommand(DriverStationCommand.RequestParticularConfiguration, packet.extra);
        }
        break;
      case DriverStationCommand.RequestParticularConfigurationResp:
        if (typeof packet.extra === 'string') {
          this.update({ hardwareXml: packet.extra, configurationMessage: null });
        }
        break;
      case DriverStationCommand.ShowStacktrace:
        this.update({ error: typeof packet.extra === 'string' ? packet.extra : 'Robot error' });
        break;
    }
  }

  private handleTelemetry(packet: {
    robotState: RobotState;
    tag: string;
    strings: TelemetryEntry[];
    numbers: TelemetryEntry[];
  }) {
    if ([SYSTEM_NONE, SYSTEM_WARNING, SYSTEM_ERROR].includes(packet.tag)) {
      const message = packet.tag === SYSTEM_NONE ? null : systemMessage(packet);
      this.update({
        robotState: packet.robotState,
        warning: packet.tag === SYSTEM_WARNING ? message : null,
        error: packet.tag === SYSTEM_ERROR ? message : null,
      });
      return;
    }

    const battery = packet.strings.find((entry) => entry.key === BATTERY_KEY)?.value;
    const batteryVoltage =
      battery === undefined || battery === NO_VOLTAGE_SENSOR
        ? this.snapshot.batteryVoltage
        : Number.parseFloat(String(battery));
    const telemetry = [...packet.strings, ...packet.numbers].filter(
      (entry) => !(entry.key.startsWith('$') && entry.key.endsWith('$'))
    );
    this.update({
      robotState: packet.robotState,
      telemetry,
      batteryVoltage:
        batteryVoltage !== null && Number.isFinite(batteryVoltage)
          ? batteryVoltage
          : null,
    });
  }
}

export function describeConnectionHealth(snapshot: DriverStationSnapshot) {
  if (snapshot.status !== 'connected') return 'Offline';
  if (snapshot.latencyMs === null) return 'Connecting';
  if (snapshot.latencyMs < 80) return 'Excellent';
  if (snapshot.latencyMs < 180) return 'Good';
  if (snapshot.latencyMs < 400) return 'Fair';
  return 'Poor';
}

export function describeRobotState(state: RobotState) {
  switch (state) {
    case RobotState.NotStarted:
      return 'Not started';
    case RobotState.Init:
      return 'Initializing';
    case RobotState.Running:
      return 'Ready';
    case RobotState.Stopped:
      return 'Stopped';
    case RobotState.EmergencyStop:
      return 'Emergency stop';
    default:
      return 'Unknown';
  }
}

export const driverStationCompatibilityLabel = `FTC SDK ${FTC_SDK_VERSION} | Robocol ${ROBOCOL_VERSION}`;
