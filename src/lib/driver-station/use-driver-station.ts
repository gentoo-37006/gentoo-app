import * as React from 'react';
import { AppState } from 'react-native';
import { DriverStationClient, type DriverStationSnapshot } from './client';
import { createDriverStationTransport } from './transport';
import { setPhoneRumble } from './phone-rumble';
import { keepDriverStationAwake, releaseDriverStationWifi } from '../../../modules/gentoo-driver-station';

export function useDriverStation() {
  const [client] = React.useState(
    () => new DriverStationClient(createDriverStationTransport())
  );
  const [snapshot, setSnapshot] = React.useState<DriverStationSnapshot>(
    client.getSnapshot()
  );

  React.useEffect(() => {
    const unsubscribe = client.subscribe(setSnapshot);
    const unsubscribeRumble = client.subscribeRumble((effect) => {
      setPhoneRumble(AppState.currentState === 'active' ? effect : null);
    });
    void client.start();
    void keepDriverStationAwake(true).catch(() => {});
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        client.setControllerEnabled(false);
        client.stopOpMode();
      }
      void keepDriverStationAwake(state === 'active').catch(() => {});
    });
    return () => {
      appStateSubscription.remove();
      unsubscribe();
      client.disconnect();
      unsubscribeRumble();
      setPhoneRumble(null);
      void keepDriverStationAwake(false).catch(() => {});
      void releaseDriverStationWifi().catch(() => {});
    };
  }, [client]);

  return { client, snapshot };
}
