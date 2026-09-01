import {
  addDriverStationDatagramListener,
  addDriverStationSocketErrorListener,
  isDriverStationTransportAvailable,
  sendDriverStationDatagram,
  startDriverStationSocket,
  stopDriverStationSocket,
  type DatagramEvent,
} from '../../../modules/gentoo-driver-station';

export type RemoveListener = { remove: () => void };

export interface DriverStationTransport {
  available: boolean;
  start(port: number): Promise<void>;
  stop(): Promise<void>;
  send(data: string, host: string, port: number): Promise<void>;
  onDatagram(listener: (event: DatagramEvent) => void): RemoveListener | null;
  onError(listener: (message: string) => void): RemoveListener | null;
}

export const driverStationTransport: DriverStationTransport = {
  available: isDriverStationTransportAvailable,
  start: startDriverStationSocket,
  stop: stopDriverStationSocket,
  send: sendDriverStationDatagram,
  onDatagram: addDriverStationDatagramListener,
  onError(listener) {
    return addDriverStationSocketErrorListener((event) => listener(event.message));
  },
};
