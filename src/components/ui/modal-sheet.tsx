import * as React from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import {
  initialWindowMetrics,
  SafeAreaProvider,
  SafeAreaView,
} from 'react-native-safe-area-context';
import { FadeModal } from '@/components/ui/fade-modal';
import { DragOverlayProvider } from '@/components/drag-overlay';
import {
  ScreenScrollTrackerProvider,
  useCreateScreenScrollTracker,
} from '@/components/ui/screen';

const NATIVE_BACK_SWIPE_EDGE = 32;
const NATIVE_BACK_SWIPE_DISTANCE_RATIO = 0.25;
const NATIVE_BACK_SWIPE_VELOCITY = 0.5;

/** Centred dialog over a tap-away backdrop. */
export function ModalSheet({
  visible,
  onClose,
  scrollEnabled = true,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  scrollEnabled?: boolean;
  children: React.ReactNode;
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [nativePageX] = React.useState(() => new Animated.Value(0));
  const nativeScrollTracker = useCreateScreenScrollTracker();

  React.useEffect(() => {
    if (visible) nativePageX.setValue(0);
  }, [nativePageX, visible]);

  const nativeSwipeResponder = React.useMemo(() => {
    const shouldStart = (_event: unknown, gesture: { dx: number; dy: number; x0: number }) =>
      gesture.x0 <= NATIVE_BACK_SWIPE_EDGE &&
      gesture.dx > 8 &&
      Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.2;

    const returnToStart = () => {
      Animated.spring(nativePageX, {
        toValue: 0,
        stiffness: 300,
        damping: 30,
        mass: 1,
        overshootClamping: true,
        useNativeDriver: true,
      }).start();
    };

    return PanResponder.create({
      onMoveShouldSetPanResponder: shouldStart,
      onMoveShouldSetPanResponderCapture: shouldStart,
      onPanResponderGrant: Keyboard.dismiss,
      onPanResponderMove: (_event, gesture) => {
        nativePageX.setValue(Math.max(0, gesture.dx));
      },
      onPanResponderRelease: (_event, gesture) => {
        const shouldClose =
          gesture.dx >= viewportWidth * NATIVE_BACK_SWIPE_DISTANCE_RATIO ||
          gesture.vx >= NATIVE_BACK_SWIPE_VELOCITY;
        if (!shouldClose) {
          returnToStart();
          return;
        }
        Animated.spring(nativePageX, {
          toValue: viewportWidth,
          velocity: Math.max(gesture.vx, 0.8),
          stiffness: 300,
          damping: 30,
          mass: 1,
          overshootClamping: true,
          useNativeDriver: true,
        }).start(({ finished }) => {
          if (finished) onClose();
        });
      },
      onPanResponderTerminate: returnToStart,
      onPanResponderTerminationRequest: () => false,
    });
  }, [nativePageX, onClose, viewportWidth]);

  if (Platform.OS !== 'web') {
    return (
      <FadeModal visible={visible} onRequestClose={onClose}>
        {(opacity) => (
          <SafeAreaProvider initialMetrics={initialWindowMetrics} style={{ flex: 1 }}>
            <DragOverlayProvider>
              <ScreenScrollTrackerProvider tracker={nativeScrollTracker}>
                <Animated.View
                  {...nativeSwipeResponder.panHandlers}
                  style={{ flex: 1, opacity, transform: [{ translateX: nativePageX }] }}
                >
                  <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-background">
                    <KeyboardAvoidingView
                      className="flex-1"
                      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    >
                      <TouchableWithoutFeedback
                        accessible={false}
                        onPress={Keyboard.dismiss}
                      >
                        <View className="flex-1">
                          <Animated.ScrollView
                            bounces
                            contentContainerStyle={{ flexGrow: 1 }}
                            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                            keyboardShouldPersistTaps="handled"
                            onScroll={Animated.event(
                              [{ nativeEvent: { contentOffset: { y: nativeScrollTracker.scrollY } } }],
                              { useNativeDriver: true }
                            )}
                            scrollEventThrottle={16}
                            showsVerticalScrollIndicator={false}
                          >
                            {children}
                          </Animated.ScrollView>
                        </View>
                      </TouchableWithoutFeedback>
                    </KeyboardAvoidingView>
                  </SafeAreaView>
                </Animated.View>
              </ScreenScrollTrackerProvider>
            </DragOverlayProvider>
          </SafeAreaProvider>
        )}
      </FadeModal>
    );
  }

  return (
    <FadeModal visible={visible} onRequestClose={onClose}>
      {(opacity) => (
        <View className="flex-1 cursor-default justify-center p-4">
          <Animated.View
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#000000',
              pointerEvents: 'box-none',
              opacity: opacity.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
            }}
          >
            <Pressable className="flex-1 cursor-default" onPress={onClose} />
          </Animated.View>
          <View className="max-h-[85%] w-full max-w-lg cursor-default self-center">
            <Animated.View style={{ opacity }}>
              <ScrollView
                scrollEnabled={scrollEnabled}
                bounces={scrollEnabled}
                overScrollMode={scrollEnabled ? 'auto' : 'never'}
                keyboardShouldPersistTaps="always"
                showsVerticalScrollIndicator={false}
              >
                {children}
              </ScrollView>
            </Animated.View>
          </View>
        </View>
      )}
    </FadeModal>
  );
}
