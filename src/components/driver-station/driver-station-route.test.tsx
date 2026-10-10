import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { useRouter, useNavigation } from 'expo-router';
import DriverStationRoute from '@/app/(app)/driver-station';
import { DriverStationClient } from '@/lib/driver-station/client';
import { useDriverStation } from '@/lib/driver-station/use-driver-station';

jest.mock('expo-router', () => ({ useRouter: jest.fn(), useNavigation: jest.fn() }));
jest.mock('@/lib/driver-station/use-driver-station', () => ({ useDriverStation: jest.fn() }));
jest.mock('@/lib/driver-station/haptics', () => ({ controllerPressHaptic: jest.fn() }));
jest.mock('@/components/driver-station/robot-wifi-panel', () => ({ RobotWifiPanel: () => null }));
jest.mock('@/components/driver-station/controller-panel', () => ({ ControllerPanel: () => null }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: jest.requireActual<typeof import('react-native')>('react-native').View }));

const replace = jest.fn();
let client: DriverStationClient;
beforeEach(() => {
  client = new DriverStationClient({ available: false, start: async () => {}, stop: async () => {}, send: async () => {}, onDatagram: () => null, onError: () => null });
  jest.mocked(useDriverStation).mockReturnValue({ client, snapshot: client.getSnapshot() });
  jest.mocked(useRouter).mockReturnValue({ replace, canGoBack: () => false } as unknown as ReturnType<typeof useRouter>);
  jest.mocked(useNavigation).mockReturnValue({ addListener: () => () => {} } as unknown as ReturnType<typeof useNavigation>);
});

describe('Driver Station exit', () => {
  it('stops controls and navigates home even without back history or a robot connection', async () => {
    const stop = jest.spyOn(client, 'stopOpMode');
    const screen = await render(<DriverStationRoute />);
    await fireEvent.press(screen.getByLabelText('Leave Driver Station'));
    expect(stop).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
    await screen.unmount();
  });
  it.each(['control', 'controller'])('can exit the %s view while an OpMode is running', async (view) => {
    jest.mocked(useDriverStation).mockReturnValue({ client, snapshot: {
      ...client.getSnapshot(), status: 'connected', activeOpMode: 'Drive', opModePhase: 'running',
    } });
    const stop = jest.spyOn(client, 'stopOpMode');
    const screen = await render(<DriverStationRoute />);
    if (view === 'controller') await fireEvent.press(screen.getByLabelText('Show controller'));
    await fireEvent.press(screen.getByLabelText('Leave Driver Station'));
    expect(stop).toHaveBeenCalled();
    expect(replace).toHaveBeenCalledWith('/');
    expect(stop.mock.invocationCallOrder[0]).toBeLessThan(replace.mock.invocationCallOrder[0]);
    await screen.unmount();
  });
});
