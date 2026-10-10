import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { RobotWifiPanel } from './robot-wifi-panel';
import { connectRobotWifi, readRobotWifi, saveRobotWifi } from '@/lib/driver-station/wifi';
import { FadeModal } from '@/components/ui/fade-modal';

jest.mock('@/components/ui/fade-modal', () => ({ FadeModal: jest.fn(() => { throw new Error('Wi-Fi must not open a second native modal'); }) }));

jest.mock('@/lib/driver-station/wifi', () => ({
  readRobotWifi: jest.fn(), saveRobotWifi: jest.fn(), connectRobotWifi: jest.fn(), forgetRobotWifi: jest.fn(),
}));
jest.mock('../../../modules/gentoo-driver-station', () => ({ openDriverStationWifiSettings: jest.fn() }));

describe('Robot Wi-Fi', () => {
  it('loads saved credentials and reports a Settings fallback without claiming robot connection', async () => {
    jest.mocked(readRobotWifi).mockResolvedValueOnce({ ssid: '12345-RC', password: 'password' });
    jest.mocked(saveRobotWifi).mockResolvedValueOnce(undefined);
    jest.mocked(connectRobotWifi).mockResolvedValueOnce('settings-required');
    const screen = await render(<RobotWifiPanel canConnect onClose={jest.fn()} />);
    expect(FadeModal).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Robot network name').props.value).toBe('12345-RC'));
    await fireEvent.press(screen.getByText('Save & connect'));
    await waitFor(() => expect(connectRobotWifi).toHaveBeenCalledWith({ ssid: '12345-RC', password: 'password' }));
    await waitFor(() => expect(screen.getByText(/This build cannot join Wi-Fi directly/)).toBeTruthy());
    await screen.unmount();
  });

  it('keeps closing available while credentials are loading', async () => {
    jest.mocked(readRobotWifi).mockImplementationOnce(() => new Promise(() => {}));
    const onClose = jest.fn();
    const screen = await render(<RobotWifiPanel canConnect onClose={onClose} />);
    await fireEvent.press(screen.getByLabelText('Close Robot Wi-Fi'));
    expect(onClose).toHaveBeenCalled();
    await screen.unmount();
  });

  it('does not change networks while an OpMode is active', async () => {
    jest.mocked(readRobotWifi).mockResolvedValueOnce(null);
    const screen = await render(<RobotWifiPanel canConnect={false} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Save & connect')).toBeTruthy());
    await fireEvent.press(screen.getByText('Save & connect'));
    expect(connectRobotWifi).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
