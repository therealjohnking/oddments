/**
 * Tokenization helpers for Slopometer.
 *
 * Everything here is pure and offset-preserving: the returned `start`/`end`
 * indices are UTF-16 offsets into the *original* input, so findings can be
 * highlighted exactly where they occur. We never rewrite the input (line
 * endings included) — that would shift every offset.
 *
 * This is deliberately a pragmatic tokenizer, not a linguistic parser. Sentence
 * splitting handles the common cases (abbreviations, decimals, quotes) and is
 * intentionally shallow; Slopometer's premise is heuristic, not authoritative.
 */

export interface Sentence {
  text: string;
  start: number;
  end: number;
  wordCount: number;
}

export interface Paragraph {
  text: string;
  start: number;
  end: number;
  wordCount: number;
  sentenceCount: number;
}

export interface Line {
  text: string;
  start: number;
  end: number;
}

/** Word-like token: starts with a letter/number, may contain apostrophes/hyphens. */
const WORD_RE = /[\p{L}\p{N}][\p{L}\p{N}'’_-]*/gu;

/** Count word-like tokens in a string. */
export function countWords(text: string): number {
  const matches = text.match(WORD_RE);
  return matches ? matches.length : 0;
}

/** Count Unicode code points (astral-safe), without allocating an array. */
export function countCodePoints(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    count++;
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
  }
  return count;
}

/**
 * Normalize curly quotes/apostrophes to their straight ASCII equivalents for
 * phrase matching. Every replaced character is a single UTF-16 unit swapped for
 * a single unit, so offsets are preserved 1:1 with the original input.
 */
export function normalizeForMatch(text: string): string {
  return text.replace(/[‘’ʼ′‵]/g, "'").replace(/[“”″‶]/g, '"');
}

/** Count lines: any of LF, CRLF, or CR is one break. */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  const breaks = text.match(/\r\n|\r|\n/g);
  return (breaks ? breaks.length : 0) + 1;
}

/** Split into physical lines, preserving offsets. */
export function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  const re = /\r\n|\r|\n/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    lines.push({ text: text.slice(last, match.index), start: last, end: match.index });
    last = match.index + match[0].length;
  }
  lines.push({ text: text.slice(last), start: last, end: text.length });
  return lines;
}

/**
 * Split into paragraphs: blocks separated by a blank line (a line break, then
 * optional spaces/tabs, then another line break). A single wall of prose with no
 * blank lines is one paragraph. Leading/trailing whitespace is trimmed from each
 * block, and the recorded offsets track that trim.
 */
export function splitParagraphs(text: string): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  const separator = /(?:\r\n|\r|\n)[ \t]*(?:\r\n|\r|\n)/g;
  let blockStart = 0;
  let match: RegExpExecArray | null;

  const push = (rawStart: number, rawEnd: number): void => {
    const raw = text.slice(rawStart, rawEnd);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    const start = rawStart + leading;
    const end = start + trimmed.length;
    paragraphs.push({
      text: trimmed,
      start,
      end,
      wordCount: countWords(trimmed),
      sentenceCount: splitSentences(trimmed, start).length,
    });
  };

  while ((match = separator.exec(text)) !== null) {
    push(blockStart, match.index);
    blockStart = match.index + match[0].length;
  }
  push(blockStart, text.length);
  return paragraphs;
}

// Lowercased tokens that end in "." but rarely end a sentence. Deliberately
// excludes words that are also ordinary sentence-enders (no, co, min, max, …);
// multi-letter initialisms like "p.m." / "U.S." are handled structurally below.
const ABBREVIATIONS = new Set([
  'mr',
  'mrs',
  'ms',
  'dr',
  'prof',
  'sr',
  'jr',
  'st',
  'vs',
  'etc',
  'eg',
  'ie',
  'al',
  'inc',
  'ltd',
  'corp',
  'fig',
  'vol',
  'dept',
  'gov',
  'approx',
  'apt',
]);

// A dotted initialism ending at a boundary: "p.m.", "a.m.", "e.g.", "U.S.A.".
// Requires at least two letter-dot segments, so a lone "A." still splits.
const INITIALISM_RE = /(?:\p{L}\.){2,}$/u;

/**
 * Split a block of text into sentence units, offsets relative to `blockStart`
 * (which must be the original-input offset of `block[0]`).
 *
 * A boundary is a run of `.`/`!`/`?`/`…` that is followed by whitespace or the
 * end of the block, is not a decimal point inside a number, and is not the "."
 * of a recognized abbreviation. Trailing closing quotes/brackets stay with the
 * sentence they close.
 */
export function splitSentences(block: string, blockStart = 0): Sentence[] {
  const sentences: Sentence[] = [];
  const n = block.length;

  const emit = (from: number, to: number): void => {
    const raw = block.slice(from, to);
    const leading = raw.length - raw.trimStart().length;
    const trimmed = raw.trim();
    if (trimmed.length === 0) return;
    const start = blockStart + from + leading;
    sentences.push({
      text: trimmed,
      start,
      end: start + trimmed.length,
      wordCount: countWords(trimmed),
    });
  };

  let sentenceStart = 0;
  const boundary = /[.!?…]+/g;
  let match: RegExpExecArray | null;
  while ((match = boundary.exec(block)) !== null) {
    let cut = match.index + match[0].length;
    // Absorb trailing closing quotes/brackets into this sentence.
    while (cut < n && /["'’”)\]]/.test(block[cut] ?? '')) cut++;

    const after = cut < n ? block[cut] : '';
    const isTerminal = cut >= n || /\s/.test(after ?? '');
    if (!isTerminal) continue;

    // Decimal like "3.14": a single "." with a digit on each side.
    if (match[0] === '.') {
      const before = block[match.index - 1] ?? '';
      const next = block[match.index + 1] ?? '';
      if (/\d/.test(before) && /\d/.test(next)) continue;
    }

    // Abbreviation like "Dr." or a dotted initialism like "p.m." before a ".".
    if (match[0] === '.') {
      const tailRun = (block.slice(sentenceStart, match.index + 1).match(/[\p{L}.]+$/u) ?? [
        '',
      ])[0]!;
      const letters = tailRun.replace(/\./g, '').toLowerCase();
      if (ABBREVIATIONS.has(letters) || INITIALISM_RE.test(tailRun)) continue;
    }

    emit(sentenceStart, cut);
    sentenceStart = cut;
  }
  if (sentenceStart < n) emit(sentenceStart, n);
  return sentences;
}

/** All sentences across the whole document, in order. */
export function documentSentences(paragraphs: Paragraph[]): Sentence[] {
  const out: Sentence[] = [];
  for (const paragraph of paragraphs) {
    out.push(...splitSentences(paragraph.text, paragraph.start));
  }
  return out;
}

/** The first word-like token of a string, lowercased (letters/numbers only). */
export function firstWord(text: string): string {
  const match = text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/u);
  return match ? match[0].toLowerCase() : '';
}
