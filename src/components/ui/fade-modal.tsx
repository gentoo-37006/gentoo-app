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
  const opacity = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      setMounted(true);
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
