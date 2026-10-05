import * as React from 'react';
import { describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render } from '@testing-library/react-native';
import { ControllerPanel, type ControllerPanelHandle } from './controller-panel';
import { type DriverStationClient } from '@/lib/driver-station/client';
import { controllerPressHaptic, controllerReleaseHaptic } from '@/lib/driver-station/haptics';

jest.mock('@/lib/driver-station/haptics', () => ({
  controllerPressHaptic: jest.fn(), controllerReleaseHaptic: jest.fn(), joystickHapticPulse: jest.fn(),
}));

function createClient() {
  return { updateGamepad: jest.fn(), setControllerEnabled: jest.fn(), resetGamepad: jest.fn() };
}

describe('ControllerPanel', () => {
  it('treats grabbing anywhere on the knob as neutral, then tracks relative drag', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
    const stick = screen.getByLabelText('Left stick');
    await fireEvent(stick, 'layout', { nativeEvent: { layout: { width: 200 } } });
    const point = { identifier: '1', pageX: 530, pageY: 410, locationX: 130, locationY: 110 };
    await fireEvent(stick, 'touchStart', { nativeEvent: { changedTouches: [point], touches: [point] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftStickX: 0, leftStickY: 0 });
    await fireEvent(stick, 'touchMove', { nativeEvent: { touches: [{ ...point, pageX: 562 }] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftStickX: 0.5, leftStickY: 0 });
    await fireEvent(stick, 'touchEnd', { nativeEvent: { changedTouches: [point], touches: [] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftStickX: 0, leftStickY: 0 });
    await screen.unmount();
  });

  it('switches gamepad slots without changing the OpMode action', async () => {
    const client = createClient();
    const select = jest.fn();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} gamepadUser={1} onSelectGamepad={select} />);
    await fireEvent.press(screen.getByLabelText('Gamepad 1'));
    expect(select).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Gamepad 2'));
    expect(select).toHaveBeenCalledWith(2);
    await screen.unmount();
  });

  it('tracks independent stick touches and resets each on release or cancellation', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
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
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
    const event = (identifier: string) => ({ nativeEvent: { changedTouches: [{ identifier }] } });
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('1'));
    expect(controllerPressHaptic).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('1'));
    expect(controllerPressHaptic).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('LB'), 'touchStart', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x102 });
    await fireEvent(screen.getByLabelText('A'), 'touchCancel');
    expect(controllerReleaseHaptic).toHaveBeenCalledTimes(1);
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 2 });
    await fireEvent(screen.getByLabelText('LB'), 'touchEnd', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0 });
    await screen.unmount();
  });

  it('allows touch interactions and haptics while disconnected', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected={false} action={null} />);
    await fireEvent(screen.getByLabelText('A'), 'touchStart', { nativeEvent: { changedTouches: [{ identifier: '1' }] } });
    expect(client.updateGamepad).toHaveBeenCalledWith({ buttons: 0x100 });
    expect(controllerPressHaptic).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByLabelText('A'), 'touchCancel');
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0 });
    await screen.unmount();
  });

  it('keeps both triggers independent in the upper shoulder controls', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
    const event = (identifier: string) => ({ nativeEvent: { changedTouches: [{ identifier }] } });
    await fireEvent(screen.getByLabelText('LT'), 'touchStart', event('1'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftTrigger: 1 });
    await fireEvent(screen.getByLabelText('RT'), 'touchStart', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ rightTrigger: 1 });
    await fireEvent(screen.getByLabelText('LT'), 'touchEnd', event('1'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftTrigger: 0 });
    await fireEvent(screen.getByLabelText('RT'), 'touchCancel');
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ rightTrigger: 0 });
    await screen.unmount();
  });

  it('supports diagonal D-pad presses alongside face buttons', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
    const event = (identifier: string) => ({ nativeEvent: { changedTouches: [{ identifier }] } });
    await fireEvent(screen.getByLabelText('D-pad up'), 'touchStart', event('1'));
    await fireEvent(screen.getByLabelText('D-pad right'), 'touchStart', event('2'));
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('3'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x1300 });
    await fireEvent(screen.getByLabelText('D-pad up'), 'touchCancel');
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x300 });
    await fireEvent(screen.getByLabelText('D-pad right'), 'touchEnd', event('2'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x100 });
    await screen.unmount();
  });

  it('resets all inputs and stale touch ownership when the screen has no touches', async () => {
    const client = createClient();
    const ref = React.createRef<ControllerPanelHandle>();
    const screen = await render(<ControllerPanel ref={ref} client={client as unknown as DriverStationClient} connected action={null} />);
    const event = (identifier: string) => ({ nativeEvent: { changedTouches: [{ identifier }] } });
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('1'));
    await fireEvent(screen.getByLabelText('D-pad left'), 'touchStart', event('2'));
    await fireEvent(screen.getByLabelText('LT'), 'touchStart', event('3'));
    const stick = screen.getByLabelText('Left stick');
    await fireEvent(stick, 'layout', { nativeEvent: { layout: { width: 200 } } });
    const point = { identifier: '4', pageX: 164, pageY: 100, locationX: 164, locationY: 100 };
    await fireEvent(stick, 'touchStart', { nativeEvent: { changedTouches: [point], touches: [point] } });
    await act(() => ref.current!.resetTouches());
    expect(client.resetGamepad).toHaveBeenCalledTimes(1);
    client.updateGamepad.mockClear();
    await fireEvent(screen.getByLabelText('Left stick'), 'touchMove', { nativeEvent: { touches: [point] } });
    expect(client.updateGamepad).not.toHaveBeenCalled();
    await fireEvent(screen.getByLabelText('A'), 'touchStart', event('5'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0x100 });
    await fireEvent(screen.getByLabelText('LT'), 'touchStart', event('6'));
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ leftTrigger: 1 });
    await screen.unmount();
  });

  it('releases a button if its finger disappears from a later touch event', async () => {
    const client = createClient();
    const screen = await render(<ControllerPanel client={client as unknown as DriverStationClient} connected action={null} />);
    const button = screen.getByLabelText('RB');
    await fireEvent(button, 'touchStart', { nativeEvent: { changedTouches: [{ identifier: '1' }] } });
    await fireEvent(button, 'touchMove', { nativeEvent: { touches: [{ identifier: '2' }] } });
    expect(client.updateGamepad).toHaveBeenLastCalledWith({ buttons: 0 });
    await screen.unmount();
  });
});
