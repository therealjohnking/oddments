/**
 * Segmentation for the highlighted-text view.
 *
 * Turns the test text plus the (non-overlapping, left-to-right) matches into a
 * flat list of renderable runs: plain text, a highlighted match, or a zero-width
 * caret marker sitting *between* two characters. Long unmatched stretches stay a
 * single text run so a large input never explodes the DOM, and rendering is
 * capped at a fixed number of UTF-16 units — matches past the cap still appear in
 * the findings list, just not in the visual reveal.
 *
 * JavaScript regex iteration never produces overlapping matches, so no
 * overlap-resolution is invented here; the one defensive clamp only guards
 * against a match that would start inside the previous one.
 */

import type { MatchRecord } from '@/lib/regex-workbench';

export type HighlightSegment =
  | { kind: 'text'; text: string }
  | { kind: 'match'; text: string; match: MatchRecord }
  | { kind: 'zero'; match: MatchRecord };

export interface HighlightModel {
  segments: HighlightSegment[];
  /** True when the text was longer than the render cap. */
  truncated: boolean;
}

export function buildHighlight(text: string, matches: MatchRecord[], cap: number): HighlightModel {
  const segments: HighlightSegment[] = [];
  const limit = Math.min(text.length, cap);
  let pos = 0;

  for (const match of matches) {
    // A zero-width match sitting exactly at the end (start === limit === text.length)
    // is still worth showing; a non-empty match must start strictly inside the window.
    if (match.empty ? match.start > limit : match.start >= limit) break;
    const start = Math.max(match.start, pos);
    if (start > pos) {
      segments.push({ kind: 'text', text: text.slice(pos, start) });
      pos = start;
    }
    if (match.empty) {
      segments.push({ kind: 'zero', match });
      // Zero-width: consumes nothing, so pos is unchanged.
    } else {
      const end = Math.min(match.end, limit);
      if (end > pos) {
        segments.push({ kind: 'match', text: text.slice(match.start, end), match });
        pos = match.end; // advance past the real end even if clamped for display
      }
    }
  }

  if (pos < limit) {
    segments.push({ kind: 'text', text: text.slice(pos, limit) });
  }

  return { segments, truncated: text.length > cap };
}
