import * as React from 'react';
import { Animated, Easing, Modal } from 'react-native';

export const FADE_DURATION_MS = 75;

export function FadeModal({
  visible,
  onRequestClose,
  onDismiss,
  children,
}: {
  visible: boolean;
  onRequestClose: () => void;
  onDismiss?: () => void;
  children: React.ReactNode | ((opacity: Animated.Value) => React.ReactNode);
}) {
  const [mounted, setMounted] = React.useState(visible);
  // State initializer, not a ref: stable across renders without reading
  // ref.current during render (react-hooks/refs).
  const [opacity] = React.useState(() => new Animated.Value(0));
  const onDismissRef = React.useRef(onDismiss);

  React.useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  // Mount in the same render pass that shows the modal — render-time
  // adjustment instead of a synchronous setState inside the effect.
  if (visible && !mounted) setMounted(true);

  React.useEffect(() => {
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: FADE_DURATION_MS,
      easing: Easing.linear,
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished || visible) return;
      setMounted(false);
      onDismissRef.current?.();
    });
    return () => animation.stop();
  }, [visible, opacity]);

  if (!mounted) return null;

  const content =
    typeof children === 'function' ? (
      children(opacity)
    ) : (
      <Animated.View
        needsOffscreenAlphaCompositing
        renderToHardwareTextureAndroid
        style={{ flex: 1, opacity }}
      >
        {children}
      </Animated.View>
    );

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      {content}
    </Modal>
  );
}
