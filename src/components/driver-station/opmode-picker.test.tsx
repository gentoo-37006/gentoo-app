import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { OpModePicker } from './opmode-picker';

const opModes = [
  { name: 'Auto', flavor: 'AUTONOMOUS', group: '' },
  { name: 'Drive', flavor: 'TELEOP', group: '' },
];
const nativeMethods = jest.requireActual<{ default: { measureInWindow: jest.Mock<(callback: (...args: number[]) => void) => void> } }>('@react-native/jest-preset/jest/MockNativeMethods').default;
beforeEach(() => {
  nativeMethods.measureInWindow.mockImplementation(function (this: { props: { testID?: string } }, callback) {
    callback(24, 70, this.props.testID === 'opmode-selector-anchor' ? 320 : 140, 44);
  });
});

describe('OpMode dropdowns', () => {
  it.each([['Autonomous', 'Auto', 'Drive', 'AUTONOMOUS'], ['TeleOp', 'Drive', 'Auto', 'TELEOP']])(
    '%s directly opens its own list without changing selection', async (label, mode, excluded, category) => {
      const onSelect = jest.fn();
      const screen = await render(<OpModePicker opModes={opModes} selected={null} connected onSelect={onSelect} />);
      await fireEvent.press(screen.getByText(label));
      expect(screen.getByText(mode)).toBeTruthy();
      expect(screen.queryByText(excluded)).toBeNull();
      expect(screen.getByTestId('select-dropdown').props.style).toEqual(expect.objectContaining({ left: 24, top: 70, width: 320 }));
      expect(onSelect).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByText(mode));
      expect(onSelect).toHaveBeenCalledWith(mode, category);
      await screen.unmount();
    }
  );
  it('can open an empty dropdown while disconnected', async () => {
    const screen = await render(<OpModePicker opModes={[]} selected={null} connected={false} onSelect={jest.fn()} />);
    expect(screen.queryByText('Waiting for Control Hub...')).toBeNull();
    await fireEvent.press(screen.getByText('TeleOp'));
    expect(screen.getByText('No matches')).toBeTruthy();
    await screen.unmount();
  });
});
