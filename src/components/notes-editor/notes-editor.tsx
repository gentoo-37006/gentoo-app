import { Linking } from 'react-native';
import NotesEditorDom, { type NotesEditorColors } from './notes-editor-dom';
import { NAV_THEME, useColorScheme } from '@/lib/theme';

/** --muted-foreground in global.css, which the WebView on native can't read. */
const MUTED = { light: '#5c5c5c', dark: '#adadad' } as const;

/** Only web and mail links leave the app; never a `javascript:` URL. */
const OPENABLE = /^(?:https?:\/\/|mailto:)/i;

/**
 * Always-editable task notes with live markdown formatting. See
 * notes-editor-dom.tsx for what it does and how it reaches each platform.
 */
export function NotesEditor({
  value,
  onChange,
  onBlur,
  placeholder,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  placeholder?: string;
}) {
  const { colorScheme } = useColorScheme();
  const scheme = colorScheme === 'dark' ? 'dark' : 'light';
  const theme = NAV_THEME[scheme].colors;
  const colors: NotesEditorColors = {
    text: String(theme.text),
    muted: MUTED[scheme],
    primary: String(theme.primary),
    border: String(theme.border),
    surface: String(theme.card),
  };

  return (
    <NotesEditorDom
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      onOpenLink={(href) => {
        if (OPENABLE.test(href)) void Linking.openURL(href);
      }}
      placeholder={placeholder}
      colors={colors}
      // Native: grow the WebView with its content and let the screen scroll.
      dom={{ matchContents: true, scrollEnabled: false }}
    />
  );
}
