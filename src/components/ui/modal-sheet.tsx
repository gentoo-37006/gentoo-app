import * as React from 'react';
import { Animated, Pressable, ScrollView, View } from 'react-native';
import { FadeModal } from '@/components/ui/fade-modal';

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
  return (
    <FadeModal visible={visible} onRequestClose={onClose}>
      {(opacity) => (
        <View className="flex-1 cursor-default justify-center p-4">
          <Animated.View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#000000',
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
