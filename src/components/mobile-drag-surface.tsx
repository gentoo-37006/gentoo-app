import * as React from 'react';
import {
  type GestureResponderEvent,
  type NativeSyntheticEvent,
  type NativeTouchEvent,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useScreenDragController } from '@/components/ui/screen';

export const MOBILE_DRAG_HOLD_MS = 1_500;
const PRE_DRAG_MOVE_TOLERANCE = 20;

type TouchEvent = NativeSyntheticEvent<NativeTouchEvent>;

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
  const screenDragController = useScreenDragController();
  const [ghostContent, setGhostContent] =
    React.useState<React.ReactNode>(null);
  const ghostVisible = ghostContent !== null;
  const holdTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const disabledRef = React.useRef(disabled);
  const touchStart = React.useRef<{
    absoluteY: number;
    localY: number;
  } | null>(null);
  const lastAbsoluteY = React.useRef(0);
  const startScrollOffset = React.useRef(0);
  const dragging = React.useRef(false);
  const queuedMoveY = React.useRef<number | null>(null);
  const moveFrame = React.useRef<number | null>(null);
  const ghostTranslateY = useSharedValue(0);
  const ghostAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ghostTranslateY.value }],
  }));

  const clearHoldTimer = () => {
    if (holdTimer.current === null) return;
    clearTimeout(holdTimer.current);
    holdTimer.current = null;
  };

  const flushQueuedMove = () => {
    if (moveFrame.current !== null) {
      cancelAnimationFrame(moveFrame.current);
      moveFrame.current = null;
    }
    const absoluteY = queuedMoveY.current;
    queuedMoveY.current = null;
    if (absoluteY !== null) onMove(absoluteY);
  };

  const queueMove = (absoluteY: number) => {
    queuedMoveY.current = absoluteY;
    if (moveFrame.current !== null) return;
    moveFrame.current = requestAnimationFrame(() => {
      moveFrame.current = null;
      const nextY = queuedMoveY.current;
      queuedMoveY.current = null;
      if (nextY !== null) onMove(nextY);
    });
  };

  const updateDragPosition = (absoluteY: number) => {
    const start = touchStart.current;
    if (!start) return;
    const scrollDelta =
      screenDragController.getScrollOffset() - startScrollOffset.current;
    // eslint-disable-next-line react-hooks/immutability -- Reanimated shared values are mutable.
    ghostTranslateY.value =
      absoluteY - start.absoluteY + scrollDelta;
    queueMove(absoluteY);
  };

  const reset = () => {
    clearHoldTimer();
    flushQueuedMove();
    touchStart.current = null;
    dragging.current = false;
    setGhostContent(null);
    screenDragController.setAutoScrollListener(null);
    screenDragController.setActive(false);
  };

  const beginTouch = (event: TouchEvent) => {
    if (disabled || holdTimer.current !== null || dragging.current) return;

    const start = {
      absoluteY: event.nativeEvent.pageY,
      localY: event.nativeEvent.locationY,
    };
    touchStart.current = start;
    lastAbsoluteY.current = start.absoluteY;
    holdTimer.current = setTimeout(() => {
      holdTimer.current = null;
      if (disabledRef.current || !touchStart.current) return;
      dragging.current = true;
      ghostTranslateY.value = 0;
      startScrollOffset.current = screenDragController.getScrollOffset();
      screenDragController.updatePointer(touchStart.current.absoluteY);
      screenDragController.setAutoScrollListener(() =>
        updateDragPosition(lastAbsoluteY.current)
      );
      screenDragController.setActive(true);
      setGhostContent(children);
      onStart(touchStart.current.absoluteY, touchStart.current.localY);
    }, MOBILE_DRAG_HOLD_MS);
  };

  const moveTouch = (event: TouchEvent | GestureResponderEvent) => {
    const absoluteY = event.nativeEvent.pageY;
    lastAbsoluteY.current = absoluteY;

    if (dragging.current) {
      event.preventDefault();
      event.stopPropagation();
      screenDragController.updatePointer(absoluteY);
      updateDragPosition(absoluteY);
      return;
    }

    const start = touchStart.current;
    if (
      start &&
      Math.abs(absoluteY - start.absoluteY) > PRE_DRAG_MOVE_TOLERANCE
    ) {
      clearHoldTimer();
      touchStart.current = null;
    }
  };

  const finishTouch = (event?: TouchEvent | GestureResponderEvent) => {
    if (!dragging.current) {
      reset();
      return;
    }

    const absoluteY = event?.nativeEvent.pageY ?? lastAbsoluteY.current;
    dragging.current = false;
    clearHoldTimer();
    flushQueuedMove();
    touchStart.current = null;
    setGhostContent(null);
    screenDragController.setAutoScrollListener(null);
    screenDragController.setActive(false);
    onEnd(absoluteY);
  };

  const cancelTouch = React.useEffectEvent(() => {
    const wasDragging = dragging.current;
    reset();
    if (wasDragging) onCancel();
  });

  React.useEffect(() => {
    disabledRef.current = disabled;
    if (disabled) {
      clearHoldTimer();
      touchStart.current = null;
    }
  }, [disabled]);

  React.useEffect(
    () => () => {
      clearHoldTimer();
      if (moveFrame.current !== null) cancelAnimationFrame(moveFrame.current);
      if (dragging.current) {
        screenDragController.setAutoScrollListener(null);
        screenDragController.setActive(false);
      }
    },
    [screenDragController]
  );

  return (
    <View
      className="relative overflow-visible"
      onTouchStart={beginTouch}
      onTouchMove={moveTouch}
      onTouchEnd={finishTouch}
      onTouchCancel={cancelTouch}
      onMoveShouldSetResponderCapture={() => dragging.current}
      onResponderMove={moveTouch}
      onResponderRelease={finishTouch}
      onResponderTerminate={cancelTouch}
      onResponderTerminationRequest={() => !dragging.current}
    >
      <View className={ghostVisible ? 'opacity-40' : undefined}>{children}</View>
      {ghostVisible ? (
        <Animated.View
          pointerEvents="none"
          className="absolute inset-0 z-50 bg-background shadow-lg"
          style={[{ elevation: 20, opacity: 0.65 }, ghostAnimatedStyle]}
        >
          {ghostContent}
        </Animated.View>
      ) : null}
    </View>
  );
}
