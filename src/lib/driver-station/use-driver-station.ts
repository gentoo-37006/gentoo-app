import * as React from 'react';
import { AppState } from 'react-native';
import { DriverStationClient, type DriverStationSnapshot } from './client';
import { createDriverStationTransport } from './transport';
import { setPhoneRumble } from './phone-rumble';

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
    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') {
        client.setControllerEnabled(false);
        client.stopOpMode();
      }
    });
    return () => {
      appStateSubscription.remove();
      unsubscribe();
      client.disconnect();
      unsubscribeRumble();
      setPhoneRumble(null);
    };
  }, [client]);

  return { client, snapshot };
}
