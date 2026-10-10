import {
  type EventSubscription,
  NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';

export type DatagramEvent = {
  data: string;
  host: string;
  port: number;
};

type DriverStationEvents = {
  onDatagram: (event: DatagramEvent) => void;
  onSocketError: (event: { message: string }) => void;
};

declare class GentooDriverStationNativeModule extends NativeModule<DriverStationEvents> {
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  send(data: string, host: string, port: number): Promise<void>;
  rumble(steps: { large: number; small: number; duration: number }[]): Promise<void>;
  stopRumble(): Promise<void>;
  joystickTick(strength: number, sharpness: number): Promise<void>;
  keepAwake(enabled: boolean): Promise<void>;
  joinWifi(ssid: string, password: string): Promise<'requested' | 'settings-required'>;
  releaseWifi(): Promise<void>;
  openWifiSettings(): Promise<void>;
}

const nativeModule =
  requireOptionalNativeModule<GentooDriverStationNativeModule>(
    'GentooDriverStation'
  );

export const isDriverStationTransportAvailable = nativeModule !== null;

export async function keepDriverStationAwake(enabled: boolean) {
  await nativeModule?.keepAwake(enabled);
}

export async function joinDriverStationWifi(ssid: string, password: string) {
  if (!nativeModule) throw new Error('Rebuild Gentoo to connect to robot Wi-Fi.');
  return nativeModule.joinWifi(ssid, password);
}

export async function releaseDriverStationWifi() { await nativeModule?.releaseWifi(); }
export async function openDriverStationWifiSettings() { await nativeModule?.openWifiSettings(); }

export async function playDriverStationRumble(steps: { large: number; small: number; duration: number }[]) {
  await nativeModule?.rumble(steps);
}

export async function stopDriverStationRumble() {
  await nativeModule?.stopRumble();
}

export async function playDriverStationJoystickTick(strength: number, sharpness: number) {
  await nativeModule?.joystickTick(strength, sharpness);
}

export async function startDriverStationSocket(port: number) {
  if (!nativeModule) throw new Error('The Driver Station native module is not installed. Rebuild Gentoo.');
  await nativeModule.start(port);
}

export async function stopDriverStationSocket() {
  await nativeModule?.stop();
}

export async function sendDriverStationDatagram(
  data: string,
  host: string,
  port: number
) {
  if (!nativeModule) throw new Error('The Driver Station native module is not installed. Rebuild Gentoo.');
  await nativeModule.send(data, host, port);
}

export function addDriverStationDatagramListener(
  listener: (event: DatagramEvent) => void
): EventSubscription | null {
  return nativeModule?.addListener('onDatagram', listener) ?? null;
}

export function addDriverStationSocketErrorListener(
  listener: (event: { message: string }) => void
): EventSubscription | null {
  return nativeModule?.addListener('onSocketError', listener) ?? null;
}
