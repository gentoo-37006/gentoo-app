import * as React from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, View } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { APP_VERSION } from '@/lib/app-version';
import { useReleaseNotes, shouldShowWhatsNew, markWhatsNewSeen } from '@/lib/release-notes';

/** Just enough markdown for GitHub release notes: headings, bullets, and
 *  stripped bold/inline-code markers. Keeps us dependency-free. */
function NotesBody({ notes }: { notes: string }) {
  const lines = notes.replace(/\r\n/g, '\n').split('\n');
  return (
    <View className="gap-1.5">
      {lines.map((raw, i) => {
        const line = raw.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
        if (/^#{1,6}\s/.test(line)) {
          return (
            <Text key={i} className="pt-2 font-bold">
              {line.replace(/^#{1,6}\s*/, '')}
            </Text>
          );
        }
        const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
        if (bullet) {
          return (
            <View key={i} className="flex-row gap-2 pl-1">
              <Text variant="muted">•</Text>
              <Text className="flex-1 text-sm">{bullet[1]}</Text>
            </View>
          );
        }
        if (!line.trim()) return <View key={i} className="h-1" />;
        return (
          <Text key={i} className="text-sm">
            {line}
          </Text>
        );
      })}
    </View>
  );
}

export function WhatsNewModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, isLoading, isError } = useReleaseNotes(visible);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="max-h-[80%] w-full max-w-md rounded-2xl border border-border bg-card p-5">
          <View className="flex-row items-center gap-2 pb-3">
            <Icon as={Sparkles} size={20} className="text-primary" />
            <Text variant="title" className="flex-1">
              What’s new in {data?.tag ?? `v${APP_VERSION}`}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close release notes"
              className="h-8 w-8 items-center justify-center rounded-full active:bg-accent"
            >
              <Icon as={X} size={18} className="text-muted-foreground" />
            </Pressable>
          </View>

          <ScrollView className="max-h-96">
            {isLoading ? (
              <View className="py-8">
                <ActivityIndicator />
              </View>
            ) : isError || !data?.notes ? (
              <Text variant="muted">Release notes aren’t available right now.</Text>
            ) : (
              <NotesBody notes={data.notes} />
            )}
          </ScrollView>

          <View className="pt-4">
            <Button label="Got it" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Mounted inside the signed-in shell: pops the release notes the first time a
 * new version launches, then records the version as seen on dismissal (so a
 * crash before dismissing shows it again next launch).
 */
export function WhatsNewGate() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    shouldShowWhatsNew().then((show) => {
      if (!cancelled && show) setVisible(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const close = React.useCallback(() => {
    setVisible(false);
    void markWhatsNewSeen();
  }, []);

  return <WhatsNewModal visible={visible} onClose={close} />;
}
