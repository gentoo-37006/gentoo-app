import { describe, expect, it } from 'vitest';
import { parseNotes, parseNotesLine } from '@/lib/notes-markdown';

describe('parseNotesLine', () => {
  // ── Behaviour that predates blockquote support; a refactor must not move it.
  it('reads headings at every level', () => {
    expect(parseNotesLine('## Ping')).toEqual({ kind: 'heading', text: 'Ping' });
    expect(parseNotesLine('###### Deep')).toEqual({ kind: 'heading', text: 'Deep' });
  });

  it('requires a space after the hashes', () => {
    // "#4 is fixed" is prose about issue 4, not a heading.
    expect(parseNotesLine('#4 is fixed')).toEqual({ kind: 'text', text: '#4 is fixed' });
  });

  it('reads all three bullet markers', () => {
    for (const marker of ['-', '*', '•']) {
      expect(parseNotesLine(`${marker} Sends a mention`)).toEqual({
        kind: 'bullet',
        text: 'Sends a mention',
      });
    }
  });

  it('strips bold and inline code', () => {
    expect(parseNotesLine('The **Ping** button uses `notifyUsers`')).toEqual({
      kind: 'text',
      text: 'The Ping button uses notifyUsers',
    });
  });

  it('treats an empty line as a spacer', () => {
    expect(parseNotesLine('')).toEqual({ kind: 'blank' });
    expect(parseNotesLine('   ')).toEqual({ kind: 'blank' });
  });

  // ── Blockquotes.
  it('reads a blockquote', () => {
    expect(parseNotesLine('> Heads up')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'text', text: 'Heads up' },
    });
  });

  it('does not require a space after the marker', () => {
    expect(parseNotesLine('>Heads up')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'text', text: 'Heads up' },
    });
  });

  it('counts nesting depth, spaced or not', () => {
    expect(parseNotesLine('>> Deeper')).toMatchObject({ kind: 'quote', depth: 2 });
    // Markdown reads "> > x" as depth 2, not a depth-1 quote of the text "> x".
    expect(parseNotesLine('> > Deeper')).toMatchObject({ kind: 'quote', depth: 2 });
  });

  it('keeps markup inside a quote working', () => {
    expect(parseNotesLine('> - a quoted bullet')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'bullet', text: 'a quoted bullet' },
    });
    expect(parseNotesLine('> ## a quoted heading')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'heading', text: 'a quoted heading' },
    });
    expect(parseNotesLine('> **bold** inside')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'text', text: 'bold inside' },
    });
  });

  it('treats a bare > as an empty quoted line', () => {
    // Keeps the bar continuous between two quoted paragraphs.
    expect(parseNotesLine('>')).toEqual({
      kind: 'quote',
      depth: 1,
      inner: { kind: 'blank' },
    });
  });

  it('leaves a mid-line > alone', () => {
    // Only a LEADING marker quotes; "a -> b" and "5 > 3" are prose.
    expect(parseNotesLine('Latency 5 > 3 seconds')).toEqual({
      kind: 'text',
      text: 'Latency 5 > 3 seconds',
    });
  });
});

describe('parseNotes', () => {
  it('splits on newlines and tolerates CRLF', () => {
    const nodes = parseNotes('## Ping\r\n\r\n- Nudges assignees\r\n> Takes ~15s');

    expect(nodes.map((n) => n.kind)).toEqual(['heading', 'blank', 'bullet', 'quote']);
  });

  // ── Soft wrapping. Release bodies are hard-wrapped near 80 columns; the
  //    phone renders a far narrower column, so the source breaks must not show.
  it('joins a wrapped paragraph into one block', () => {
    const nodes = parseNotes('The dashboard counted three things\nand handed you a grid of links.');

    expect(nodes).toEqual([
      { kind: 'text', text: 'The dashboard counted three things and handed you a grid of links.' },
    ]);
  });

  it('starts a new paragraph at a blank line', () => {
    const nodes = parseNotes('First para.\n\nSecond para.');

    expect(nodes).toEqual([
      { kind: 'text', text: 'First para.' },
      { kind: 'blank' },
      { kind: 'text', text: 'Second para.' },
    ]);
  });

  it('keeps a wrapped bullet inside its own bullet', () => {
    // Continuation lines are indented, so the join must not leave the stray
    // whitespace in the middle of the sentence.
    const nodes = parseNotes('- Needs attention gathers\n  everything in one place\n- Up next');

    expect(nodes).toEqual([
      { kind: 'bullet', text: 'Needs attention gathers everything in one place' },
      { kind: 'bullet', text: 'Up next' },
    ]);
  });

  it('never lets prose swallow a heading or a bullet', () => {
    const nodes = parseNotes('Intro line\n## Dashboard\n- A bullet\nSecond sentence');

    expect(nodes).toEqual([
      { kind: 'text', text: 'Intro line' },
      { kind: 'heading', text: 'Dashboard' },
      // Markdown's lazy continuation: unindented prose under a bullet is still
      // that bullet's text.
      { kind: 'bullet', text: 'A bullet Second sentence' },
    ]);
  });

  it('honours a trailing double space as a hard line break', () => {
    const nodes = parseNotes('Ship date  \nis Friday');

    expect(nodes.map((n) => n.kind)).toEqual(['text', 'text']);
  });

  it('joins quoted prose but stops at the quote boundary', () => {
    expect(parseNotes('> Heads up\n> it reruns')).toEqual([
      { kind: 'quote', depth: 1, inner: { kind: 'text', text: 'Heads up it reruns' } },
    ]);
    // Different depth, and quoted vs unquoted, are separate blocks.
    expect(parseNotes('> Outer\n>> Inner').map((n) => n.kind)).toEqual(['quote', 'quote']);
    expect(parseNotes('> Quoted\nUnquoted').map((n) => n.kind)).toEqual(['quote', 'text']);
  });

  it('leaves fenced code lines alone', () => {
    const nodes = parseNotes('```\nnpm run web\nnpm test\n```\nAfter the fence');

    expect(nodes.map((n) => ('text' in n ? n.text : n.kind))).toEqual([
      '```',
      'npm run web',
      'npm test',
      '```',
      'After the fence',
    ]);
  });
});
