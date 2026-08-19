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

/** Markdown ends a paragraph at a blank line, not at every newline: a release
 *  body hard-wrapped near 80 columns is still one paragraph. Rendering each
 *  source line separately broke it mid-sentence on phones, where the text
 *  rewraps to a much narrower column anyway. */
const HARD_BREAK = / {2,}$/;

type FlatLine = Exclude<NotesLine, { kind: 'quote' }>;

/** The merged line, or null when `next` starts something new. */
function mergeFlat(prev: FlatLine, next: FlatLine): FlatLine | null {
  // Only prose continues. A heading, bullet or blank starts its own block, and
  // a bullet absorbs the wrapped remainder of its own text (markdown's lazy
  // continuation) so it keeps its hanging indent.
  if (next.kind !== 'text') return null;
  if (prev.kind !== 'text' && prev.kind !== 'bullet') return null;
  // Two trailing spaces are markdown's hard line break — the author meant the
  // line to end there, so it never absorbs the next one.
  if (HARD_BREAK.test(prev.text)) return null;
  return { ...prev, text: `${prev.text.trimEnd()} ${next.text.trim()}` };
}

function mergeLines(prev: NotesLine, next: NotesLine): NotesLine | null {
  if (prev.kind === 'quote' || next.kind === 'quote') {
    // Quoted prose wraps too, but only inside one quote at one depth: leaving a
    // quote, or nesting deeper, is a new block.
    if (prev.kind !== 'quote' || next.kind !== 'quote') return null;
    if (prev.depth !== next.depth) return null;
    const inner = mergeFlat(prev.inner, next.inner);
    return inner ? { ...prev, inner } : null;
  }
  return mergeFlat(prev, next);
}

/** Split release-note text into renderable lines (CRLF tolerated), joining the
 *  soft-wrapped ones back into a single block. */
export function parseNotes(notes: string): NotesLine[] {
  const lines: NotesLine[] = [];
  // Fenced code is the one place newlines are load-bearing. Nothing renders it
  // as code yet, but joining it would scramble the listing outright.
  let fenced = false;
  // A fence line is a boundary from both sides: the closing ``` must not
  // absorb the prose that follows it either.
  let afterFence = false;

  for (const raw of notes.replace(/\r\n/g, '\n').split('\n')) {
    const line = parseNotesLine(raw);
    const isFence = /^\s*(```|~~~)/.test(raw);
    const prev = lines[lines.length - 1];
    const joinable = prev && !fenced && !isFence && !afterFence;
    const merged = joinable ? mergeLines(prev, line) : null;

    if (merged) lines[lines.length - 1] = merged;
    else lines.push(line);
    if (isFence) fenced = !fenced;
    afterFence = isFence;
  }

  return lines;
}
