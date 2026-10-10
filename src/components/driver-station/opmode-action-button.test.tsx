import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { Play, CircleStop } from 'lucide-react-native';
import { OpModeActionButton } from './opmode-action-button';

jest.mock('@/lib/driver-station/haptics', () => ({ controllerPressHaptic: jest.fn() }));

describe('OpMode action button', () => {
  it('can stop an initialized OpMode even if the large START button is disabled', async () => {
    const start = jest.fn();
    const stop = jest.fn();
    const screen = await render(<OpModeActionButton canStop onStop={stop} action={{ label: 'START', icon: Play, enabled: false, className: '', iconClassName: '', textClassName: '', onPress: start }} />);
    await fireEvent.press(screen.getByLabelText('START'));
    expect(start).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Stop initialized OpMode'));
    expect(stop).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
  it('does not duplicate STOP when it is already the primary action', async () => {
    const stop = jest.fn();
    const screen = await render(<OpModeActionButton compact canStop onStop={stop} action={{ label: 'STOP', icon: CircleStop, enabled: true, className: '', iconClassName: '', textClassName: '', onPress: stop }} />);
    expect(screen.queryByLabelText('Stop initialized OpMode')).toBeNull();
    await fireEvent.press(screen.getByLabelText('STOP'));
    expect(stop).toHaveBeenCalledTimes(1);
    await screen.unmount();
  });
});
