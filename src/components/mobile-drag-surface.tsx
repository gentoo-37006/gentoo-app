import * as React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';

export const MOBILE_DRAG_HOLD_MS = 1_500;

export function MobileDragSurface({
  children,
  disabled = false,
  onStart,
  onMove,
  onEnd,
  onCancel,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onStart: (absoluteY: number, localY: number) => void;
  onMove: (absoluteY: number) => void;
  onEnd: (absoluteY: number) => void;
  onCancel: () => void;
}) {
  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activateAfterLongPress(MOBILE_DRAG_HOLD_MS)
        .onStart((event) => {
          runOnJS(onStart)(event.absoluteY, event.y);
        })
        .onUpdate((event) => {
          runOnJS(onMove)(event.absoluteY);
        })
        .onEnd((event) => {
          runOnJS(onEnd)(event.absoluteY);
        })
        .onFinalize((_event, success) => {
          if (!success) runOnJS(onCancel)();
        }),
    [disabled, onCancel, onEnd, onMove, onStart]
  );

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}
