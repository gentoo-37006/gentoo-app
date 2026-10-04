import * as React from 'react';
import { AppState, Pressable, View, type GestureResponderEvent } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { type DriverStationClient } from '@/lib/driver-station/client';
import { joystickPosition } from '@/lib/driver-station/gamepad';

function TouchStick({ label, disabled, onChange }: {
  label: string;
  disabled: boolean;
  onChange: (x: number, y: number) => void;
}) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState(0);
  const touch = React.useRef<{ id: string; x: number; y: number } | null>(null);
  const move = (event: GestureResponderEvent) => {
    const origin = touch.current;
    if (!origin) return;
    const point = event.nativeEvent.touches.find((item) => item.identifier === origin.id);
    if (!point) return;
    const next = joystickPosition(point.pageX - origin.x - size / 2, point.pageY - origin.y - size / 2, size * 0.32);
    setPosition(next);
    onChange(next.x, next.y);
  };
  const release = () => {
    touch.current = null;
    setPosition({ x: 0, y: 0 });
    onChange(0, 0);
  };
  return (
    <View className="min-w-0 flex-1 items-center justify-center gap-1">
      <View
        accessibilityLabel={label}
        onLayout={(event) => setSize(event.nativeEvent.layout.width)}
        style={{ aspectRatio: 1, height: '85%', maxHeight: 220 }}
        className={cn('items-center justify-center rounded-full border-2 border-border bg-muted', disabled && 'opacity-40')}
        onTouchStart={(event) => {
          if (disabled || touch.current) return;
          const point = event.nativeEvent.changedTouches[0];
          touch.current = { id: point.identifier, x: point.pageX - point.locationX, y: point.pageY - point.locationY };
          move(event);
        }}
        onTouchMove={move}
        onTouchEnd={(event) => {
          if (event.nativeEvent.changedTouches.some((point) => point.identifier === touch.current?.id)) release();
        }}
        onTouchCancel={release}
      >
        <View style={{ pointerEvents: 'none', width: 1, height: '80%' }} className="absolute bg-border" />
        <View style={{ pointerEvents: 'none', height: 1, width: '80%' }} className="absolute bg-border" />
        <View
          className="rounded-full border-2 border-primary bg-primary/25"
          style={{ pointerEvents: 'none', width: '36%', height: '36%', transform: [{ translateX: position.x * size * 0.32 }, { translateY: position.y * size * 0.32 }] }}
        />
      </View>
      <Text className="text-[10px] font-bold text-muted-foreground">{label}</Text>
    </View>
  );
}

function HoldButton({ label, disabled, onChange }: {
  label: string; disabled: boolean; onChange: (held: boolean) => void;
}) {
  const [held, setHeld] = React.useState(false);
  const touch = React.useRef<string | null>(null);
  const release = () => { touch.current = null; setHeld(false); onChange(false); };
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      className={cn('h-11 w-11 items-center justify-center rounded-sm border border-border bg-card', held && 'border-primary bg-primary/25', disabled && 'opacity-40')}
      onTouchStart={(event) => {
        if (disabled || touch.current !== null) return;
        touch.current = event.nativeEvent.changedTouches[0].identifier;
        setHeld(true); onChange(true);
      }}
      onTouchEnd={(event) => {
        if (event.nativeEvent.changedTouches.some((point) => point.identifier === touch.current)) release();
      }}
      onTouchCancel={release}
    >
      <Text style={{ pointerEvents: 'none' }} className="text-sm font-bold">{label}</Text>
    </View>
  );
}

export function ControllerPanel({ client, connected, action, opMode, gamepadUser = 1, onSelectGamepad }: {
  client: DriverStationClient; connected: boolean; action: React.ReactNode; opMode: string | null;
  gamepadUser?: 1 | 2;
  onSelectGamepad?: (user: 1 | 2) => void;
}) {
  const buttons = React.useRef(0);
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  React.useEffect(() => {
    client.setControllerEnabled(connected && AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      buttons.current = 0;
      setActive(state === 'active');
      client.setControllerEnabled(connected && state === 'active');
    });
    return () => { subscription.remove(); client.setControllerEnabled(false); };
  }, [client, connected]);
  const button = (mask: number, held: boolean) => {
    buttons.current = held ? buttons.current | mask : buttons.current & ~mask;
    client.updateGamepad({ buttons: buttons.current });
  };
  return (
    <View key={`${active}-${gamepadUser}`} className="flex-1">
      <View className="h-16 flex-row items-center border-b border-border px-3">
        <View className="min-w-0 flex-1 gap-1 pr-2">
          <Text className="text-xs font-bold" numberOfLines={1}>{opMode ?? 'No OpMode selected'}</Text>
          <View className="flex-row self-start rounded-sm border border-border">
            {([1, 2] as const).map((user) => (
              <Pressable key={user} accessibilityRole="button" accessibilityLabel={`Gamepad ${user}`} accessibilityState={{ selected: gamepadUser === user }}
                onPress={() => {
                  if (user === gamepadUser) return;
                  buttons.current = 0;
                  onSelectGamepad?.(user);
                }}
                className={cn('h-7 items-center justify-center px-3', gamepadUser === user ? 'bg-accent' : 'bg-background')}>
                <Text className="text-[10px] font-bold">Gamepad {user}</Text>
              </Pressable>
            ))}
          </View>
        </View>
        {action}
        <View className="flex-1" />
      </View>
      <View className="h-12 flex-row items-center justify-between px-4">
        <View className="flex-row gap-2"><HoldButton label="LB" disabled={!connected} onChange={(held) => button(2, held)} /><HoldButton label="LT" disabled={!connected} onChange={(held) => client.updateGamepad({ leftTrigger: held ? 1 : 0 })} /></View>
        <View className="flex-row gap-2"><HoldButton label="RT" disabled={!connected} onChange={(held) => client.updateGamepad({ rightTrigger: held ? 1 : 0 })} /><HoldButton label="RB" disabled={!connected} onChange={(held) => button(1, held)} /></View>
      </View>
      <View className="min-h-0 flex-1 flex-row pb-2">
        <TouchStick label="Left stick" disabled={!connected} onChange={(x, y) => client.updateGamepad({ leftStickX: x, leftStickY: y })} />
        <View className="w-32 items-center justify-center gap-1">
          <HoldButton label="Y" disabled={!connected} onChange={(held) => button(0x20, held)} />
          <View className="flex-row gap-10"><HoldButton label="X" disabled={!connected} onChange={(held) => button(0x40, held)} /><HoldButton label="B" disabled={!connected} onChange={(held) => button(0x80, held)} /></View>
          <HoldButton label="A" disabled={!connected} onChange={(held) => button(0x100, held)} />
        </View>
        <TouchStick label="Right stick" disabled={!connected} onChange={(x, y) => client.updateGamepad({ rightStickX: x, rightStickY: y })} />
      </View>
    </View>
  );
}
