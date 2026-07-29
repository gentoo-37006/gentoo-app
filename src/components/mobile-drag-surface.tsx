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
  const handleStart = React.useEffectEvent(
    (absoluteY: number, localY: number) => onStart(absoluteY, localY)
  );
  const handleMove = React.useEffectEvent(
    (absoluteY: number) => onMove(absoluteY)
  );
  const handleEnd = React.useEffectEvent(
    (absoluteY: number) => onEnd(absoluteY)
  );
  const handleCancel = React.useEffectEvent(() => onCancel());

  /* eslint-disable react-hooks/preserve-manual-memoization -- Replacing an active
     RNGH gesture object cancels the drag; Effect Events provide the latest handlers. */
  const gesture = React.useMemo(
    () =>
      Gesture.Pan()
        .enabled(!disabled)
        .activateAfterLongPress(MOBILE_DRAG_HOLD_MS)
        .onStart((event) => {
          runOnJS(handleStart)(event.absoluteY, event.y);
        })
        .onUpdate((event) => {
          runOnJS(handleMove)(event.absoluteY);
        })
        .onEnd((event) => {
          runOnJS(handleEnd)(event.absoluteY);
        })
        .onFinalize((_event, success) => {
          if (!success) runOnJS(handleCancel)();
        }),
    [disabled]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}
