'use dom';

/**
 * The task-notes editor: Tiptap (ProseMirror) running as an Expo DOM
 * component. On the web it renders in the page like any other component; on
 * iOS and Android Expo hosts it in a WebView and bridges the props, so every
 * platform gets the same editor.
 *
 * Notes are still stored as markdown. Tiptap parses it on load and writes it
 * back on every change (underline, which markdown lacks, is kept as `<u>…</u>`).
 * Formatting happens as you type: `# ` makes a heading (more #s, smaller),
 * `- ` a bullet, `1. ` a numbered list, `[ ] ` a checklist item, `> ` a quote,
 * and Ctrl/Cmd+B, I, U, Shift+S and E toggle bold, italic, underline, strike
 * and code.
 */
import * as React from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import type { DOMProps } from 'expo/dom';

export type NotesEditorColors = {
  text: string;
  muted: string;
  primary: string;
  border: string;
  surface: string;
};

type Props = {
  /** Markdown. Changes from outside (another member's edit) replace the content. */
  value: string;
  onChange: (markdown: string) => void;
  onBlur?: () => void;
  onOpenLink?: (href: string) => void;
  placeholder?: string;
  colors: NotesEditorColors;
  dom?: DOMProps;
};

/** How long typing pauses before the markdown is sent out. */
const EMIT_DELAY_MS = 250;

function css(colors: NotesEditorColors) {
  return `
  .gentoo-notes { color: ${colors.text}; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 16px; line-height: 1.6; }
  .gentoo-notes .ProseMirror { outline: none; min-height: 320px; padding: 2px 0 24px; word-wrap: break-word; white-space: pre-wrap; }
  .gentoo-notes .ProseMirror > * + * { margin-top: 0.55em; }
  .gentoo-notes p { margin: 0; }
  .gentoo-notes h1, .gentoo-notes h2, .gentoo-notes h3, .gentoo-notes h4, .gentoo-notes h5, .gentoo-notes h6 { line-height: 1.25; margin: 1.1em 0 0.2em; font-weight: 700; }
  .gentoo-notes .ProseMirror > :first-child { margin-top: 0; }
  .gentoo-notes h1 { font-size: 1.85em; letter-spacing: -0.01em; }
  .gentoo-notes h2 { font-size: 1.5em; }
  .gentoo-notes h3 { font-size: 1.25em; }
  .gentoo-notes h4 { font-size: 1.1em; }
  .gentoo-notes h5 { font-size: 1em; }
  .gentoo-notes h6 { font-size: 0.9em; color: ${colors.muted}; }
  .gentoo-notes ul, .gentoo-notes ol { padding-left: 1.4em; margin: 0.3em 0; }
  .gentoo-notes ul { list-style: disc outside; }
  .gentoo-notes ul ul { list-style-type: circle; }
  .gentoo-notes ul ul ul { list-style-type: square; }
  .gentoo-notes ol { list-style: decimal outside; }
  .gentoo-notes li { display: list-item; }
  .gentoo-notes li > p { margin: 0; }
  .gentoo-notes li + li { margin-top: 0.15em; }
  .gentoo-notes ul[data-type="taskList"] { list-style: none; padding-left: 0.2em; }
  .gentoo-notes ul[data-type="taskList"] ul[data-type="taskList"] { padding-left: 1.2em; }
  .gentoo-notes ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 0.5em; }
  .gentoo-notes ul[data-type="taskList"] li > label { margin-top: 0.2em; user-select: none; }
  .gentoo-notes ul[data-type="taskList"] li > label input { width: 1em; height: 1em; accent-color: ${colors.primary}; cursor: pointer; }
  .gentoo-notes ul[data-type="taskList"] li > div { flex: 1; min-width: 0; }
  .gentoo-notes ul[data-type="taskList"] li[data-checked="true"] > div { color: ${colors.muted}; text-decoration: line-through; }
  .gentoo-notes blockquote { border-left: 3px solid ${colors.border}; margin: 0.4em 0; padding: 0.1em 0 0.1em 0.9em; color: ${colors.muted}; }
  .gentoo-notes code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.88em; background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 3px; padding: 0.05em 0.3em; }
  .gentoo-notes pre { background: ${colors.surface}; border: 1px solid ${colors.border}; border-radius: 3px; padding: 0.7em 0.9em; overflow-x: auto; }
  .gentoo-notes pre code { background: none; border: 0; padding: 0; font-size: 0.88em; }
  .gentoo-notes a { color: ${colors.primary}; text-decoration: underline; cursor: text; }
  .gentoo-notes hr { border: 0; border-top: 1px solid ${colors.border}; margin: 1.2em 0; }
  .gentoo-notes .is-editor-empty:first-child::before { content: attr(data-placeholder); color: ${colors.muted}; float: left; height: 0; pointer-events: none; }
  .gentoo-notes-toolbar { display: flex; flex-wrap: wrap; gap: 2px; padding: 4px; margin-bottom: 10px; border: 1px solid ${colors.border}; border-radius: 3px; background: ${colors.surface}; position: sticky; top: 0; z-index: 1; }
  .gentoo-notes-toolbar button { all: unset; box-sizing: border-box; min-width: 30px; height: 30px; padding: 0 7px; border-radius: 3px; font: 600 13px/30px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: ${colors.text}; text-align: center; cursor: pointer; }
  .gentoo-notes-toolbar button:hover { background: ${colors.border}; }
  .gentoo-notes-toolbar button[aria-pressed="true"] { background: ${colors.primary}; color: ${colors.surface}; }
  .gentoo-notes-toolbar .sep { width: 1px; margin: 4px 3px; background: ${colors.border}; }
  .gentoo-notes-hint { font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: ${colors.muted}; margin-top: 4px; }
  `;
}

type Tool = {
  label: string;
  title: string;
  style?: React.CSSProperties;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
};

const TOOLS: (Tool | 'sep')[] = [
  { label: 'H1', title: 'Heading 1 (# )', isActive: (e) => e.isActive('heading', { level: 1 }), run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { label: 'H2', title: 'Heading 2 (## )', isActive: (e) => e.isActive('heading', { level: 2 }), run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { label: 'H3', title: 'Heading 3 (### )', isActive: (e) => e.isActive('heading', { level: 3 }), run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  'sep',
  { label: 'B', title: 'Bold (Ctrl/Cmd+B)', style: { fontWeight: 800 }, isActive: (e) => e.isActive('bold'), run: (e) => e.chain().focus().toggleBold().run() },
  { label: 'I', title: 'Italic (Ctrl/Cmd+I)', style: { fontStyle: 'italic' }, isActive: (e) => e.isActive('italic'), run: (e) => e.chain().focus().toggleItalic().run() },
  { label: 'U', title: 'Underline (Ctrl/Cmd+U)', style: { textDecoration: 'underline' }, isActive: (e) => e.isActive('underline'), run: (e) => e.chain().focus().toggleUnderline().run() },
  { label: 'S', title: 'Strikethrough (Ctrl/Cmd+Shift+S)', style: { textDecoration: 'line-through' }, isActive: (e) => e.isActive('strike'), run: (e) => e.chain().focus().toggleStrike().run() },
  { label: '</>', title: 'Code (Ctrl/Cmd+E)', isActive: (e) => e.isActive('code'), run: (e) => e.chain().focus().toggleCode().run() },
  'sep',
  { label: '•', title: 'Bulleted list (- )', isActive: (e) => e.isActive('bulletList'), run: (e) => e.chain().focus().toggleBulletList().run() },
  { label: '1.', title: 'Numbered list (1. )', isActive: (e) => e.isActive('orderedList'), run: (e) => e.chain().focus().toggleOrderedList().run() },
  { label: '☐', title: 'Checklist ([ ] )', isActive: (e) => e.isActive('taskList'), run: (e) => e.chain().focus().toggleTaskList().run() },
  { label: '❝', title: 'Quote (> )', isActive: (e) => e.isActive('blockquote'), run: (e) => e.chain().focus().toggleBlockquote().run() },
];

function Toolbar({ editor, focused, onOpenLink }: { editor: Editor; focused: boolean; onOpenLink?: (href: string) => void }) {
  // Re-render on selection changes so pressed states follow the cursor.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      active: TOOLS.map((tool) => (tool === 'sep' ? false : tool.isActive(e))),
      link: e.isActive('link') ? (e.getAttributes('link').href as string | undefined) ?? null : null,
    }),
  });

  return (
    <div
      className="gentoo-notes-toolbar"
      role="toolbar"
      aria-label="Formatting"
      style={{ opacity: focused ? 1 : 0.55, transition: 'opacity 120ms ease' }}
    >
      {TOOLS.map((tool, index) =>
        tool === 'sep' ? (
          <span key={`sep${index}`} className="sep" />
        ) : (
          <button
            key={tool.label}
            type="button"
            title={tool.title}
            aria-label={tool.title}
            aria-pressed={state.active[index]}
            style={tool.style}
            // Keep the selection: a normal mousedown would blur the editor first.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => tool.run(editor)}
          >
            {tool.label}
          </button>
        )
      )}
      {state.link && onOpenLink ? (
        <>
          <span className="sep" />
          <button
            type="button"
            title="Open link"
            aria-label="Open link"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onOpenLink(state.link!)}
          >
            Open link ↗
          </button>
        </>
      ) : null}
    </div>
  );
}

export default function NotesEditorDom({ value, onChange, onBlur, onOpenLink, placeholder, colors }: Props) {
  const [focused, setFocused] = React.useState(false);
  // What the editor last sent out; an incoming value equal to it is our own echo.
  const lastEmitted = React.useRef(value);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const callbacks = React.useRef({ onChange, onBlur, onOpenLink });
  React.useEffect(() => {
    callbacks.current = { onChange, onBlur, onOpenLink };
  });

  const flush = React.useCallback((editor: Editor) => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    const markdown = editor.getMarkdown();
    if (markdown === lastEmitted.current) return;
    lastEmitted.current = markdown;
    callbacks.current.onChange(markdown);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: { openOnClick: false, autolink: true, linkOnPaste: true, defaultProtocol: 'https' },
      }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: placeholder ?? 'Write notes…' }),
      Markdown,
    ],
    content: value,
    contentType: 'markdown',
    editorProps: {
      attributes: { 'aria-label': 'Task notes', spellcheck: 'true' },
      // Ctrl/Cmd+click follows a link; a plain click places the cursor in it.
      handleClick: (_view, _pos, event) => {
        const link = (event.target as HTMLElement | null)?.closest?.('a');
        const href = link?.getAttribute('href');
        if (href && (event.metaKey || event.ctrlKey)) {
          callbacks.current.onOpenLink?.(href);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => flush(e), EMIT_DELAY_MS);
    },
    onFocus: () => setFocused(true),
    onBlur: ({ editor: e }) => {
      setFocused(false);
      flush(e);
      callbacks.current.onBlur?.();
    },
  });

  // Content changed somewhere else (realtime, another task): load it unless
  // it's just what we sent.
  React.useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    if (value === editor.getMarkdown()) {
      lastEmitted.current = value;
      return;
    }
    lastEmitted.current = value;
    editor.commands.setContent(value, { contentType: 'markdown', emitUpdate: false });
  }, [editor, value]);

  React.useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return (
    <div className="gentoo-notes">
      <style>{css(colors)}</style>
      {editor ? <Toolbar editor={editor} focused={focused} onOpenLink={onOpenLink} /> : null}
      <EditorContent editor={editor} />
    </div>
  );
}
