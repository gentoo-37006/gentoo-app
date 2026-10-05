import * as React from 'react';
import { AppState, Pressable, View, type GestureResponderEvent } from 'react-native';
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { type DriverStationClient } from '@/lib/driver-station/client';
import { joystickPosition } from '@/lib/driver-station/gamepad';
import { controllerPressHaptic, controllerReleaseHaptic, joystickHapticPulse } from '@/lib/driver-station/haptics';
import { JoystickHapticFeedback } from '@/lib/driver-station/joystick-haptics';
import { isRobotRumbling } from '@/lib/driver-station/rumble-priority';

function TouchStick({ label, onChange, feedback }: {
  label: string;
  feedback: JoystickHapticFeedback;
  onChange: (x: number, y: number) => void;
}) {
  const [position, setPosition] = React.useState({ x: 0, y: 0 });
  const [size, setSize] = React.useState(0);
  const touch = React.useRef<{ id: string; x: number; y: number } | null>(null);
  React.useEffect(() => () => feedback.release(label), [feedback, label]);
  const move = (event: GestureResponderEvent) => {
    const origin = touch.current;
    if (!origin) return;
    const point = event.nativeEvent.touches.find((item) => item.identifier === origin.id);
    if (!point) { release(); return; }
    const next = joystickPosition(point.pageX - origin.x - size / 2, point.pageY - origin.y - size / 2, size * 0.32);
    feedback.move(label, next.x, next.y);
    setPosition(next);
    onChange(next.x, next.y);
  };
  const release = () => {
    feedback.release(label);
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
        className="items-center justify-center rounded-full border-2 border-border bg-muted"
        onTouchStart={(event) => {
          if (touch.current) return;
          const point = event.nativeEvent.changedTouches[0];
          const onKnob = Math.hypot(point.locationX - size / 2, point.locationY - size / 2) <= size * 0.18;
          // Grabbing the knob uses the finger's starting position as neutral.
          touch.current = {
            id: point.identifier,
            x: point.pageX - (onKnob ? size / 2 : point.locationX),
            y: point.pageY - (onKnob ? size / 2 : point.locationY),
          };
          move(event);
        }}
        onTouchMove={move}
        onTouchEnd={(event) => {
          if (event.nativeEvent.changedTouches.some((point) => point.identifier === touch.current?.id) ||
            !event.nativeEvent.touches.some((point) => point.identifier === touch.current?.id)) release();
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

function HoldButton({ label, onChange, wide = false, icon }: {
  label: string; onChange: (held: boolean) => void; wide?: boolean;
  icon?: typeof ChevronUp;
}) {
  const [held, setHeld] = React.useState(false);
  const touch = React.useRef<string | null>(null);
  const release = () => {
    if (touch.current !== null) controllerReleaseHaptic();
    touch.current = null; setHeld(false); onChange(false);
  };
  return (
    <View
      accessibilityLabel={label}
      accessibilityRole="button"
      className={cn('h-11 items-center justify-center rounded-sm border border-border bg-card', wide ? 'w-16' : 'w-11', held && 'border-primary bg-primary/25')}
      onTouchStart={(event) => {
        if (touch.current !== null) return;
        touch.current = event.nativeEvent.changedTouches[0].identifier;
        controllerPressHaptic();
        setHeld(true); onChange(true);
      }}
      onTouchEnd={(event) => {
        if (event.nativeEvent.changedTouches.some((point) => point.identifier === touch.current) ||
            (event.nativeEvent.touches && !event.nativeEvent.touches.some((point) => point.identifier === touch.current))) release();
      }}
      onTouchMove={(event) => {
        if (touch.current !== null && !event.nativeEvent.touches.some((point) => point.identifier === touch.current)) release();
      }}
      onTouchCancel={release}
    >
      <View style={{ pointerEvents: 'none' }}>
        {icon ? <Icon as={icon} size={20} className="text-foreground" /> : <Text className="text-sm font-bold">{label}</Text>}
      </View>
    </View>
  );
}

export type ControllerPanelHandle = { resetTouches: () => void };

export function ControllerPanel({ client, connected, action, ref, gamepadUser = 1, onSelectGamepad }: {
  client: DriverStationClient; connected: boolean; action: React.ReactNode;
  ref?: React.Ref<ControllerPanelHandle>;
  gamepadUser?: 1 | 2;
  onSelectGamepad?: (user: 1 | 2) => void;
}) {
  const buttons = React.useRef(0);
  const [feedback] = React.useState(() => new JoystickHapticFeedback(joystickHapticPulse, isRobotRumbling));
  const [active, setActive] = React.useState(AppState.currentState === 'active');
  const [resetVersion, setResetVersion] = React.useState(0);
  React.useImperativeHandle(ref, () => ({
    resetTouches() {
      buttons.current = 0;
      feedback.release('Left stick');
      feedback.release('Right stick');
      feedback.dispose();
      client.resetGamepad();
      setResetVersion((version) => version + 1);
    },
  }), [client, feedback]);
  React.useEffect(() => {
    client.setControllerEnabled(connected && AppState.currentState === 'active');
    const subscription = AppState.addEventListener('change', (state) => {
      buttons.current = 0;
      if (state !== 'active') feedback.dispose();
      setActive(state === 'active');
      client.setControllerEnabled(connected && state === 'active');
    });
    return () => { subscription.remove(); feedback.dispose(); client.setControllerEnabled(false); };
  }, [client, connected, feedback]);
  const button = (mask: number, held: boolean) => {
    buttons.current = held ? buttons.current | mask : buttons.current & ~mask;
    client.updateGamepad({ buttons: buttons.current });
  };
  return (
    <View key={`${active}-${gamepadUser}`} className="flex-1">
      <View className="h-24 flex-row items-start gap-3 px-6 py-2">
        <View key={`left-${resetVersion}`} className="min-w-0 flex-1 items-start gap-1">
          <View className="flex-row gap-2"><HoldButton label="LT" wide onChange={(held) => client.updateGamepad({ leftTrigger: held ? 1 : 0 })} /><HoldButton label="LB" wide onChange={(held) => button(2, held)} /></View>
        </View>
        <View className="w-44 items-center gap-2">
          <View className="flex-row rounded-sm border border-border">
            {([1, 2] as const).map((user) => (
              <Pressable key={user} accessibilityRole="button" accessibilityLabel={`Gamepad ${user}`} accessibilityState={{ selected: gamepadUser === user }}
                onPress={() => {
                  if (user === gamepadUser) return;
                  controllerReleaseHaptic();
                  buttons.current = 0;
                  feedback.dispose();
                  onSelectGamepad?.(user);
                }}
                className={cn('h-7 items-center justify-center px-3', gamepadUser === user ? 'bg-accent' : 'bg-background')}>
                <Text className="text-[10px] font-bold">Gamepad {user}</Text>
              </Pressable>
            ))}
          </View>
          {action}
        </View>
        <View key={`right-${resetVersion}`} className="min-w-0 flex-1 items-end">
          <View className="flex-row gap-2"><HoldButton label="RB" wide onChange={(held) => button(1, held)} /><HoldButton label="RT" wide onChange={(held) => client.updateGamepad({ rightTrigger: held ? 1 : 0 })} /></View>
        </View>
      </View>
      <View key={resetVersion} className="min-h-0 flex-1 flex-row pb-2">
        <TouchStick label="Left stick" feedback={feedback} onChange={(x, y) => client.updateGamepad({ leftStickX: x, leftStickY: y })} />
        <View className="w-72 flex-row items-center justify-center gap-8">
          <View className="w-32 items-center gap-1">
            <HoldButton label="D-pad up" icon={ChevronUp} onChange={(held) => button(0x1000, held)} />
            <View className="flex-row gap-10"><HoldButton label="D-pad left" icon={ChevronLeft} onChange={(held) => button(0x400, held)} /><HoldButton label="D-pad right" icon={ChevronRight} onChange={(held) => button(0x200, held)} /></View>
            <HoldButton label="D-pad down" icon={ChevronDown} onChange={(held) => button(0x800, held)} />
          </View>
          <View className="w-32 items-center gap-1">
            <HoldButton label="Y" onChange={(held) => button(0x20, held)} />
            <View className="flex-row gap-10"><HoldButton label="X" onChange={(held) => button(0x40, held)} /><HoldButton label="B" onChange={(held) => button(0x80, held)} /></View>
            <HoldButton label="A" onChange={(held) => button(0x100, held)} />
          </View>
        </View>
        <TouchStick label="Right stick" feedback={feedback} onChange={(x, y) => client.updateGamepad({ rightStickX: x, rightStickY: y })} />
      </View>
    </View>
  );
}
