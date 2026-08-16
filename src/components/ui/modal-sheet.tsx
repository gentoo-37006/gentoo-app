import * as React from 'react';
import {
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  if (Platform.OS !== 'web') {
    return (
      <FadeModal visible={visible} onRequestClose={onClose}>
        {(opacity) => (
          <Animated.View style={{ flex: 1, opacity }}>
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
                    <ScrollView
                      bounces
                      contentContainerStyle={{ flexGrow: 1 }}
                      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                      keyboardShouldPersistTaps="handled"
                      showsVerticalScrollIndicator={false}
                    >
                      {children}
                    </ScrollView>
                  </View>
                </TouchableWithoutFeedback>
              </KeyboardAvoidingView>
            </SafeAreaView>
          </Animated.View>
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
