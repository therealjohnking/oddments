/**
 * Per-side summary statistics for one input. These are plain counts a person can
 * verify — code points, graphemes, words, lines, bytes — plus the line-ending
 * profile, which is central to the "looks identical" diagnostics.
 */

import { countCodePoints, countGraphemes, utf8ByteLength } from '@/lib/inspector';
import type { LineEndingCounts, SideStats } from './types';

/** Above this UTF-16 length, skip the costlier grapheme count. */
const GRAPHEME_LIMIT = 200_000;

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/u).length;
}

/** Tally line terminators, dominant style, mixing, and final-newline state. */
export function computeLineEndings(text: string): LineEndingCounts {
  let lf = 0;
  let cr = 0;
  let crlf = 0;
  const n = text.length;
  let i = 0;
  let endsWithTerminator = false;
  while (i < n) {
    const code = text.charCodeAt(i);
    if (code === 0x0d) {
      if (i + 1 < n && text.charCodeAt(i + 1) === 0x0a) {
        crlf++;
        i += 2;
      } else {
        cr++;
        i += 1;
      }
      endsWithTerminator = i === n;
    } else if (code === 0x0a) {
      lf++;
      i += 1;
      endsWithTerminator = i === n;
    } else {
      i += 1;
      endsWithTerminator = false;
    }
  }
  const total = lf + cr + crlf;
  const styles: [Exclude<LineEndingCounts['dominant'], null>, number][] = [
    ['lf', lf],
    ['crlf', crlf],
    ['cr', cr],
  ];
  let dominant: LineEndingCounts['dominant'] = null;
  let best = 0;
  for (const [style, count] of styles) {
    if (count > best) {
      best = count;
      dominant = style;
    }
  }
  const mixed = styles.filter(([, count]) => count > 0).length > 1;
  return { lf, cr, crlf, total, mixed, dominant, finalNewline: n > 0 && endsWithTerminator };
}

/** Count the lines in `text` (a trailing terminator yields a final empty line). */
export function countLines(text: string): number {
  if (text.length === 0) return 0;
  return computeLineEndings(text).total + 1;
}

/** Compute the summary statistics for one side. */
export function computeSideStats(text: string): SideStats {
  const chars = countCodePoints(text);
  const graphemes = text.length > GRAPHEME_LIMIT ? chars : countGraphemes(text);
  return {
    isEmpty: text.length === 0,
    chars,
    graphemes,
    words: countWords(text),
    lines: countLines(text),
    bytes: utf8ByteLength(text),
    lineEndings: computeLineEndings(text),
  };
}
