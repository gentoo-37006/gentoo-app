import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { FadeModal } from '@/components/ui/fade-modal';

/** Centred dialog over a tap-away backdrop. */
export function ModalSheet({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <FadeModal visible={visible} onRequestClose={onClose}>
      <View className="flex-1 cursor-default justify-center p-4">
        <Pressable
          className="absolute inset-0 cursor-default bg-black/50"
          onPress={onClose}
        />
        <View className="max-h-[85%] w-full max-w-lg cursor-default self-center">
          <ScrollView keyboardShouldPersistTaps="always" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </View>
    </FadeModal>
  );
}
