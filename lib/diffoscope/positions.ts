/**
 * Position helpers. Diff and equality work in UTF-16 internally (that is how
 * JavaScript strings are indexed), but everything shown to a human is expressed
 * in 1-based lines and *code-point* columns — the counts people can actually
 * verify. Never surface a raw UTF-16 index as a "column".
 */

import { countCodePoints } from '@/lib/inspector';

export interface LineCol {
  /** 1-based line number. */
  line: number;
  /** 1-based code-point column within the line. */
  column: number;
}

/**
 * A precomputed index of a string's line starts, so many offsets can be mapped
 * to line/column cheaply. Line breaks are LF, CRLF, or CR (matching the rest of
 * the engine).
 */
export class LineIndex {
  private readonly text: string;
  /** UTF-16 offsets at which each line begins (lineStarts[0] === 0). */
  private readonly lineStarts: number[];

  constructor(text: string) {
    this.text = text;
    const starts = [0];
    const n = text.length;
    let i = 0;
    while (i < n) {
      const code = text.charCodeAt(i);
      if (code === 0x0d) {
        const crlf = i + 1 < n && text.charCodeAt(i + 1) === 0x0a;
        i += crlf ? 2 : 1;
        starts.push(i);
      } else if (code === 0x0a) {
        i += 1;
        starts.push(i);
      } else {
        i += 1;
      }
    }
    this.lineStarts = starts;
  }

  /** Map a UTF-16 offset to a 1-based line and code-point column. */
  locate(offset: number): LineCol {
    const clamped = Math.max(0, Math.min(offset, this.text.length));
    // Binary search for the greatest lineStart <= clamped.
    let lo = 0;
    let hi = this.lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this.lineStarts[mid]! <= clamped) lo = mid;
      else hi = mid - 1;
    }
    const lineStart = this.lineStarts[lo]!;
    const column = countCodePoints(this.text.slice(lineStart, clamped)) + 1;
    return { line: lo + 1, column };
  }
}
