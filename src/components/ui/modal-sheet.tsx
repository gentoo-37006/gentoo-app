import * as React from 'react';
import { Pressable, ScrollView } from 'react-native';
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
      <Pressable className="flex-1 justify-center bg-black/50 p-4" onPress={onClose}>
        <Pressable className="max-h-[85%] w-full max-w-lg self-center" onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </FadeModal>
  );
}
