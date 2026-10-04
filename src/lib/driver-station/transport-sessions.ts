import type { DriverStationTransport } from './transport';

// Native exposes one socket. Serialize operations and prevent a retired page
// from closing or sending through the socket owned by its replacement.
export function createTransportSessions(native: DriverStationTransport) {
  let owner: symbol | null = null;
  let socketOwner: symbol | null = null;
  let tail = Promise.resolve();
  function enqueue(operation: () => Promise<void>) {
    const result = tail.then(operation);
    tail = result.catch(() => undefined);
    return result;
  }

  return (): DriverStationTransport => {
    let session: symbol | null = null;
    return {
      available: native.available,
      start(port) {
        const token = Symbol('Driver Station socket');
        session = token;
        owner = token;
        return enqueue(async () => {
          if (owner !== token) return;
          socketOwner = null;
          await native.start(port);
          socketOwner = token;
        });
      },
      stop() {
        const token = session;
        session = null;
        if (owner === token) owner = null;
        return enqueue(async () => {
          if (token === null || socketOwner !== token) return;
          await native.stop();
          socketOwner = null;
        });
      },
      send(data, host, port) {
        const token = session;
        return enqueue(async () => {
          if (token === null || socketOwner !== token) return;
          await native.send(data, host, port);
        });
      },
      onDatagram(listener) {
        return native.onDatagram((event) => {
          if (session !== null && owner === session && socketOwner === session) listener(event);
        });
      },
      onError(listener) {
        return native.onError((error) => {
          if (session !== null && owner === session && socketOwner === session) listener(error);
        });
      },
    };
  };
}
