import * as React from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

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
  const dragStarted = useSharedValue(false);
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
      Gesture.LongPress()
        .enabled(!disabled)
        .minDuration(MOBILE_DRAG_HOLD_MS)
        .maxDistance(24)
        .shouldCancelWhenOutside(false)
        .cancelsTouchesInView(true)
        .onStart((event) => {
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          dragStarted.value = true;
          runOnJS(handleStart)(event.absoluteY, event.y);
        })
        .onTouchesMove((event) => {
          const touch = event.allTouches[0];
          if (touch) runOnJS(handleMove)(touch.absoluteY);
        })
        .onEnd((event, success) => {
          if (success) runOnJS(handleEnd)(event.absoluteY);
        })
        .onFinalize((_event, success) => {
          if (!success && dragStarted.value) runOnJS(handleCancel)();
          // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
          dragStarted.value = false;
        }),
    [disabled, dragStarted]
  );
  /* eslint-enable react-hooks/preserve-manual-memoization */

  return (
    <GestureDetector gesture={gesture}>
      <View>{children}</View>
    </GestureDetector>
  );
}
