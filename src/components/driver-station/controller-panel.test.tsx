import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import { ControllerPanel } from './controller-panel';
import { type DriverStationClient } from '@/lib/driver-station/client';

function createClient() {
  return { updateGamepad: jest.fn(), setControllerEnabled: jest.fn() };
}

describe('ControllerPanel', () => {
  it('switches gamepad slots without changing the OpMode action', async () => {
    const client = createClient();
    const select = jest.fn();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} opMode="TeleOp" gamepadUser={1} onSelectGamepad={select} />);
    await fireEvent.press(screen.getByLabelText('Gamepad 1'));
    expect(select).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Gamepad 2'));
    expect(select).toHaveBeenCalledWith(2);
    await screen.unmount();
  });

  it('tracks independent stick touches and resets each on release or cancellation', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} opMode="TeleOp" />);
    const left = screen.getByLabelText('Left stick');
    const right = screen.getByLabelText('Right stick');
    await fireEvent(left, 'layout', { nativeEvent: { layout: { width: 200 } } });
    await fireEvent(right, 'layout', { nativeEvent: { layout: { width: 200 } } });
    const first = { identifier: '1', pageX: 164, pageY: 100, locationX: 164, locationY: 100 };
    const second = { identifier: '2', pageX: 500, pageY: 36, locationX: 100, locationY: 36 };
    await fireEvent(left, 'touchStart', { nativeEvent: { changedTouches: [first], touches: [first] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftStickX: 1, leftStickY: 0 });
    await fireEvent(right, 'touchStart', { nativeEvent: { changedTouches: [second], touches: [first, second] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ rightStickX: 0, rightStickY: -1 });
    await fireEvent(left, 'touchEnd', { nativeEvent: { changedTouches: [first], touches: [second] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftStickX: 0, leftStickY: 0 });
    await fireEvent(right, 'touchCancel');
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ rightStickX: 0, rightStickY: 0 });
    await screen.unmount();
    expect(client.setControllerEnabled).toHaveBeenLastCalledWith(false);
  });

  it('combines held buttons and clears cancelled touches', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} opMode="TeleOp" />);
    const event = (identifier: string) => ({ nativeEvent: { changedTouches: [{ identifier }] } });
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('1'));
    await fireEvent(screen.getByLabelText('LB'), 'touchStart', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x102 });
    await fireEvent(screen.getByLabelText('A'), 'touchCancel');
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 2 });
    await fireEvent(screen.getByLabelText('LB'), 'touchEnd', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0 });
    await screen.unmount();
  });

  it('ignores input while disconnected', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected={false} action={null} opMode={null} />);
    await fireEvent(screen.getByLabelText('A'), 'touchStart', { nativeEvent: { changedTouches: [{ identifier: '1' }] } });
    expect(client.updateGamepad).not.toHaveBeenCalled();
    await screen.unmount();
  });
});
