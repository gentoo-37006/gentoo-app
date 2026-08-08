import * as React from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View, type TextStyle } from 'react-native';
import { Sparkles, X } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { FadeModal } from '@/components/ui/fade-modal';
import { APP_VERSION } from '@/lib/app-version';
import { parseNotes, type NotesLine } from '@/lib/notes-markdown';
import { useReleaseNotes, shouldShowWhatsNew, markWhatsNewSeen } from '@/lib/release-notes';

// Release notes carry long unbroken tokens — migration names like
// 0024_sync_project_status, identifiers, URLs. Native Text already drops an
// over-long word onto the next line; on web it would instead run past the
// modal's right edge and under the scrollbar.
const WRAP_ANYWHERE = (Platform.OS === 'web' ? { overflowWrap: 'anywhere' } : undefined) as
  | TextStyle
  | undefined;

/** One parsed line. Quotes recurse once, so `> - item` is a quoted bullet
 *  rather than a line that literally reads "- item". */
function NotesLineView({ node }: { node: NotesLine }) {
  switch (node.kind) {
    case 'heading':
      return (
        <Text className="pt-2 font-bold" style={WRAP_ANYWHERE}>
          {node.text}
        </Text>
      );
    case 'bullet':
      return (
        <View className="w-full flex-row gap-2 pl-1">
          <Text variant="muted">•</Text>
          {/* min-w-0 lets the flex child shrink below its content width —
              without it a long token widens the row instead of wrapping. */}
          <Text className="min-w-0 flex-1 text-sm" style={WRAP_ANYWHERE}>
            {node.text}
          </Text>
        </View>
      );
    case 'blank':
      return <View className="h-1" />;
    case 'quote':
      return (
        <View className="w-full flex-row gap-2">
          {/* One bar per nesting level; the default stretch alignment makes
              each bar match the height of the text beside it. */}
          {Array.from({ length: node.depth }, (_, d) => (
            <View key={d} className="w-0.5 rounded-full bg-border" />
          ))}
          <View className="min-w-0 flex-1 opacity-70">
            <NotesLineView node={node.inner} />
          </View>
        </View>
      );
    default:
      return (
        <Text className="text-sm" style={WRAP_ANYWHERE}>
          {node.text}
        </Text>
      );
  }
}

/** Just enough markdown for GitHub release notes: headings, bullets,
 *  blockquotes, and stripped bold/inline-code markers. Parsing lives in
 *  lib/notes-markdown.ts so it is covered by `npm test`. */
function NotesBody({ notes }: { notes: string }) {
  return (
    <View className="w-full gap-1.5">
      {parseNotes(notes).map((node, i) => (
        <NotesLineView key={i} node={node} />
      ))}
    </View>
  );
}

export function WhatsNewModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, isLoading, isError } = useReleaseNotes(visible);

  return (
    <FadeModal visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/50 p-6">
        <View className="max-h-[80%] w-full max-w-md rounded-md border border-border bg-card p-5">
          <View className="flex-row items-center gap-2 pb-3">
            <Icon as={Sparkles} size={20} className="text-primary" />
            <Text variant="title" className="flex-1">
              What’s new in {data?.tag ?? `v${APP_VERSION}`}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityLabel="Close release notes"
              className="h-8 w-8 items-center justify-center rounded-sm active:bg-accent"
            >
              <Icon as={X} size={18} className="text-muted-foreground" />
            </Pressable>
          </View>

          {/* pr-3 keeps the text clear of the web scrollbar, which is drawn
              inside the ScrollView's box and would otherwise sit on top of it. */}
          <ScrollView className="max-h-96" contentContainerClassName="pr-3">
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
    </FadeModal>
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
