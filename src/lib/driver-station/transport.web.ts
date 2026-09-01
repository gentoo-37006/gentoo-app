import type { DriverStationTransport } from './transport';

const unsupported = async () => {
  throw new Error('Driver Station is available only in the Gentoo mobile app.');
};

export const driverStationTransport: DriverStationTransport = {
  available: false,
  start: unsupported,
  stop: async () => undefined,
  send: unsupported,
  onDatagram: () => null,
  onError: () => null,
};
