import * as React from 'react';
import { Animated, Modal } from 'react-native';

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
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = React.useState(visible);
  // State initializer, not a ref: stable across renders without reading
  // ref.current during render (react-hooks/refs).
  const [opacity] = React.useState(() => new Animated.Value(0));

  // Mount in the same render pass that shows the modal — render-time
  // adjustment instead of a synchronous setState inside the effect.
  if (visible && !mounted) setMounted(true);

  React.useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_DURATION_MS,
        useNativeDriver: true,
      }).start();
      return;
    }

    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_DURATION_MS,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      setMounted(false);
      onDismiss?.();
    });
  }, [visible, opacity, onDismiss]);

  if (!mounted) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onRequestClose}>
      <Animated.View style={{ flex: 1, opacity }}>{children}</Animated.View>
    </Modal>
  );
}
