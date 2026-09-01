import * as React from 'react';
import { AppState } from 'react-native';
import { DriverStationClient, type DriverStationSnapshot } from './client';
import { driverStationTransport } from './transport';

export function useDriverStation() {
  const [client] = React.useState(
    () => new DriverStationClient(driverStationTransport)
  );
  const [snapshot, setSnapshot] = React.useState<DriverStationSnapshot>(
    client.getSnapshot()
  );

  React.useEffect(() => {
    const unsubscribe = client.subscribe(setSnapshot);
    void client.start();
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') client.stopOpMode();
    });
    return () => {
      appStateSubscription.remove();
      unsubscribe();
      client.disconnect();
    };
  }, [client]);

  return { client, snapshot };
}
