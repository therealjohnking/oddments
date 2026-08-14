/**
 * Tokenizers for Diffoscope.
 *
 * The grapheme and word tokenizers preserve the exact source: concatenating the
 * `value`s reproduces the input byte-for-byte. The line tokenizer is the one
 * exception — a line's `value` excludes its terminator, which is stored on
 * `token.terminator`, so `value + terminator` per line reconstructs the input.
 * Every token records the UTF-16 `start` offset it came from. Character
 * tokenization is Unicode-aware —
 * it groups by grapheme cluster (via `Intl.Segmenter` when available, falling
 * back to code points) so emoji, accented letters, combining sequences, and ZWJ
 * emoji are never split down the middle.
 */

import type { LineTerminator, Token } from './types';

interface GraphemeSegmenter {
  segment: (input: string) => Iterable<{ segment: string; index: number }>;
}

let segmenter: GraphemeSegmenter | null | undefined;

/** Resolve (and cache) a grapheme segmenter, or `null` when unsupported. */
function graphemeSegmenter(): GraphemeSegmenter | null {
  if (segmenter !== undefined) return segmenter;
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (locale?: string, options?: { granularity: 'grapheme' }) => GraphemeSegmenter;
    }
  ).Segmenter;
  segmenter = Segmenter ? new Segmenter(undefined, { granularity: 'grapheme' }) : null;
  return segmenter;
}

/** Iterate code points with their UTF-16 start offsets (astral-safe). */
export function* codePoints(text: string): Generator<{ value: string; start: number }> {
  let i = 0;
  const n = text.length;
  while (i < n) {
    const cp = text.codePointAt(i);
    if (cp === undefined) break;
    const width = cp > 0xffff ? 2 : 1;
    yield { value: text.slice(i, i + width), start: i };
    i += width;
  }
}

/**
 * Split text into grapheme-cluster tokens. Uses `Intl.Segmenter` for correct
 * user-perceived characters; without it, falls back to code points (still
 * astral-safe — no surrogate pair is ever split).
 */
export function tokenizeGraphemes(text: string): Token[] {
  const tokens: Token[] = [];
  const seg = graphemeSegmenter();
  if (seg) {
    for (const { segment, index } of seg.segment(text)) {
      tokens.push({ value: segment, start: index, kind: 'grapheme' });
    }
    return tokens;
  }
  for (const { value, start } of codePoints(text)) {
    tokens.push({ value, start, kind: 'grapheme' });
  }
  return tokens;
}

// A "word" character: letters, numbers, and combining marks (so a base letter
// keeps its diacritics in the same token). Everything else is whitespace or a
// standalone punctuation/symbol token.
const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const WHITESPACE_CHAR = /\s/u;

/**
 * Split text into word, whitespace, and punctuation tokens, grapheme by
 * grapheme. Consecutive word graphemes join into one word token and consecutive
 * whitespace graphemes into one space token; every other grapheme (punctuation,
 * symbols, dashes, quotes) becomes its own token, so a single changed mark is
 * isolated instead of dragging its neighbours along.
 */
export function tokenizeWords(text: string): Token[] {
  const tokens: Token[] = [];
  let buf = '';
  let bufStart = 0;
  let bufKind: 'word' | 'space' | null = null;

  const flush = () => {
    if (bufKind !== null && buf.length > 0) {
      tokens.push({ value: buf, start: bufStart, kind: bufKind });
    }
    buf = '';
    bufKind = null;
  };

  for (const { value, start } of graphemeIterator(text)) {
    // Classify by the grapheme's first code point (its base character).
    const first = value.codePointAt(0) ?? 0;
    const ch = String.fromCodePoint(first);
    if (WORD_CHAR.test(ch)) {
      if (bufKind !== 'word') flush();
      if (bufKind === null) {
        bufStart = start;
        bufKind = 'word';
      }
      buf += value;
    } else if (WHITESPACE_CHAR.test(ch)) {
      if (bufKind !== 'space') flush();
      if (bufKind === null) {
        bufStart = start;
        bufKind = 'space';
      }
      buf += value;
    } else {
      flush();
      tokens.push({ value, start, kind: 'punct' });
    }
  }
  flush();
  return tokens;
}

/** Grapheme iterator with offsets, used by the word tokenizer. */
function* graphemeIterator(text: string): Generator<{ value: string; start: number }> {
  const seg = graphemeSegmenter();
  if (seg) {
    for (const { segment, index } of seg.segment(text)) {
      yield { value: segment, start: index };
    }
    return;
  }
  yield* codePoints(text);
}

/**
 * Split text into line tokens. Each token's `value` is the line content
 * *without* its terminator; the terminator style (LF / CRLF / CR / none) is kept
 * separately for diagnostics. A trailing terminator yields a final empty line,
 * matching how editors count lines.
 */
export function tokenizeLines(text: string): Token[] {
  const tokens: Token[] = [];
  const n = text.length;
  let lineStart = 0;
  let i = 0;

  const push = (contentEnd: number, terminator: LineTerminator) => {
    tokens.push({
      value: text.slice(lineStart, contentEnd),
      start: lineStart,
      kind: 'line',
      terminator,
    });
  };

  while (i < n) {
    const code = text.charCodeAt(i);
    if (code === 0x0d) {
      const crlf = i + 1 < n && text.charCodeAt(i + 1) === 0x0a;
      push(i, crlf ? 'crlf' : 'cr');
      i += crlf ? 2 : 1;
      lineStart = i;
    } else if (code === 0x0a) {
      push(i, 'lf');
      i += 1;
      lineStart = i;
    } else {
      i += 1;
    }
  }
  // Final segment after the last terminator (may be empty).
  push(n, 'none');
  return tokens;
}

/** Tokenize `text` for the given mode. */
export function tokenize(text: string, mode: 'word' | 'char' | 'line'): Token[] {
  if (mode === 'char') return tokenizeGraphemes(text);
  if (mode === 'line') return tokenizeLines(text);
  return tokenizeWords(text);
}
