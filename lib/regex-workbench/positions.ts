/**
 * Position helpers for Regex Workbench.
 *
 * JavaScript's `RegExp` indexes strings in **UTF-16 code units** — every match
 * `.index`, every capture-group range in `.indices`, and `lastIndex` are all
 * UTF-16 offsets. That is the ground truth this tool never lies about: an offset
 * shown as a "code-unit index" really is one.
 *
 * Humans, though, verify positions in 1-based lines and *code-point* columns —
 * an astral emoji is one column, not two — so line/column is derived separately
 * and always labelled as such. We reuse the inspector's `countCodePoints`, the
 * same primitive Diffoscope's positions layer builds on, rather than duplicating
 * a surrogate-pair scanner.
 */

import { countCodePoints } from '@/lib/inspector';

export interface LineCol {
  /** 1-based line number. */
  line: number;
  /** 1-based code-point column within the line. */
  column: number;
}

/**
 * A precomputed index of a string's line starts, so many UTF-16 offsets can be
 * mapped to line/column cheaply. Line breaks are LF, CRLF, or CR (matching the
 * rest of Oddments).
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
