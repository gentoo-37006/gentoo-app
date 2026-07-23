import { View } from 'react-native';
import { useMarkdown } from 'react-native-marked';
import { NAV_THEME, useColorScheme } from '@/lib/theme';

/**
 * Renders markdown with react-native-marked. Uses the hook (not the default
 * component) because that one renders a FlatList, which can't nest inside the
 * Screen scroll view.
 */
export function Markdown({ value }: { value: string }) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const { text, border, primary, card } = NAV_THEME[scheme].colors;
  const elements = useMarkdown(value, {
    colorScheme: scheme,
    theme: { colors: { text, border, link: primary, code: card } },
    styles: { text: { color: text }, code: { borderWidth: 1, borderColor: border } },
  });
  return <View className="gap-1">{elements}</View>;
}
