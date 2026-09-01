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
}

const nativeModule =
  requireOptionalNativeModule<GentooDriverStationNativeModule>(
    'GentooDriverStation'
  );

export const isDriverStationTransportAvailable = nativeModule !== null;

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
