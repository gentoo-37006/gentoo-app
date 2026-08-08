/**
 * Just enough markdown for GitHub release notes, kept dependency-free.
 *
 * Parsing lives here rather than inside the What's New component so it can be
 * covered by `npm test` (vitest, node env). Component tests run under a
 * separate `test:ui` script that CI does not invoke.
 *
 * Deliberately line-oriented: release notes are short, and a real markdown
 * engine would drag a parser and a renderer into the mobile bundle.
 */

export type NotesLine =
  | { kind: 'heading'; text: string }
  | { kind: 'bullet'; text: string }
  | { kind: 'blank' }
  | { kind: 'text'; text: string }
  /** `inner` is never another quote — every leading `>` is consumed at once. */
  | { kind: 'quote'; depth: number; inner: Exclude<NotesLine, { kind: 'quote' }> };

/** Bold and inline code are stripped, not rendered: no nested styling here. */
function stripInline(line: string): string {
  return line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1');
}

function classify(line: string): Exclude<NotesLine, { kind: 'quote' }> {
  if (/^#{1,6}\s/.test(line)) {
    return { kind: 'heading', text: line.replace(/^#{1,6}\s*/, '') };
  }
  const bullet = line.match(/^\s*[-*•]\s+(.*)$/);
  if (bullet) return { kind: 'bullet', text: bullet[1] };
  if (!line.trim()) return { kind: 'blank' };
  return { kind: 'text', text: line };
}

export function parseNotesLine(raw: string): NotesLine {
  const line = stripInline(raw);
  // `(?:>\s?)+` so "> > x" counts as depth 2 the way markdown reads it, not as
  // a depth-1 quote whose body happens to start with ">".
  const quote = line.match(/^\s*((?:>\s?)+)(.*)$/);
  if (quote) {
    const depth = (quote[1].match(/>/g) ?? []).length;
    return { kind: 'quote', depth, inner: classify(quote[2]) };
  }
  return classify(line);
}

/** Split release-note text into renderable lines (CRLF tolerated). */
export function parseNotes(notes: string): NotesLine[] {
  return notes.replace(/\r\n/g, '\n').split('\n').map(parseNotesLine);
}
