/**
 * Best-effort display-width measurement for monospace alignment.
 *
 * A JavaScript string's UTF-16 `.length` is not its visible width: astral
 * characters are two code units but one glyph, combining marks add no width, and
 * CJK/emoji glyphs occupy two monospace columns. Aligned tables need a measure
 * closer to what a terminal or monospace editor would show.
 *
 * This is a documented approximation, not a promise of pixel-perfect alignment:
 *   - Grapheme clusters are used when `Intl.Segmenter` is available, so a base
 *     letter plus combining marks counts once; otherwise we fall back to
 *     iterating Unicode scalar values (still surrogate-pair-safe).
 *   - East Asian Wide / Fullwidth scalars and emoji presentation count as 2.
 *   - Zero-width, default-ignorable, and combining scalars count as 0.
 *   - Unusual emoji ZWJ sequences and some regional-indicator pairs may still be
 *     over- or under-counted; when alignment would be unreliable, the caller's
 *     `auto` strategy chooses the record layout instead.
 */

// Compact East Asian Wide / Fullwidth ranges (start, end inclusive), covering the
// common CJK, Hangul, Kana, fullwidth-forms and wide-symbol blocks.
const WIDE_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x1100, 0x115f], // Hangul Jamo
  [0x2329, 0x232a], // angle brackets
  [0x2e80, 0x303e], // CJK radicals … Kangxi
  [0x3041, 0x33ff], // Hiragana … CJK compat
  [0x3400, 0x4dbf], // CJK Ext A
  [0x4e00, 0x9fff], // CJK Unified
  [0xa000, 0xa4cf], // Yi
  [0xac00, 0xd7a3], // Hangul Syllables
  [0xf900, 0xfaff], // CJK Compatibility Ideographs
  [0xfe10, 0xfe19], // vertical forms
  [0xfe30, 0xfe6f], // CJK compat forms + small forms
  [0xff00, 0xff60], // Fullwidth forms
  [0xffe0, 0xffe6], // Fullwidth signs
  [0x1f300, 0x1f64f], // emoji: symbols & pictographs, emoticons
  [0x1f680, 0x1f6ff], // emoji: transport & map symbols (🚀 🚗 🛒)
  [0x1f7e0, 0x1f7ff], // emoji: coloured geometric shapes (🟠 🟥)
  [0x1f900, 0x1f9ff], // emoji: supplemental symbols
  [0x1fa70, 0x1faff], // emoji: symbols extended-A
  [0x20000, 0x3fffd], // CJK Ext B+ (astral)
];

// Zero-width and default-ignorable scalars that contribute no columns.
const ZERO_WIDTH = new Set<number>([
  0x200b, // zero-width space
  0x200c, // zero-width non-joiner
  0x200d, // zero-width joiner
  0x2060, // word joiner
  0xfeff, // BOM / zero-width no-break space
]);

function inRanges(cp: number, ranges: ReadonlyArray<readonly [number, number]>): boolean {
  let lo = 0;
  let hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const range = ranges[mid]!;
    if (cp < range[0]) hi = mid - 1;
    else if (cp > range[1]) lo = mid + 1;
    else return true;
  }
  return false;
}

/** Width of a single Unicode scalar value (code point). */
function scalarWidth(cp: number): number {
  if (cp === 0) return 0;
  // C0/C1 control characters render as nothing here (they never reach a cell).
  if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) return 0;
  if (ZERO_WIDTH.has(cp)) return 0;
  // Combining marks (Mn/Mc/Me broad ranges) and variation selectors → 0.
  if (
    (cp >= 0x0300 && cp <= 0x036f) || // combining diacritical marks
    (cp >= 0x1ab0 && cp <= 0x1aff) ||
    (cp >= 0x1dc0 && cp <= 0x1dff) ||
    (cp >= 0x20d0 && cp <= 0x20ff) || // combining marks for symbols
    (cp >= 0xfe00 && cp <= 0xfe0f) || // variation selectors
    (cp >= 0xfe20 && cp <= 0xfe2f) // combining half marks
  ) {
    return 0;
  }
  if (inRanges(cp, WIDE_RANGES)) return 2;
  return 1;
}

const segmenter: Intl.Segmenter | null = (() => {
  try {
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      return new Intl.Segmenter('en', { granularity: 'grapheme' });
    }
  } catch {
    // fall through
  }
  return null;
})();

/** Width of one grapheme cluster: the base scalar's width, wide if any scalar is wide. */
function clusterWidth(cluster: string): number {
  // A regional-indicator pair renders as one double-width flag glyph (🇺🇸). The
  // code-point fallback path already sums two indicators to 2; match it here so
  // the Segmenter and fallback paths agree.
  const first = cluster.codePointAt(0);
  if (first !== undefined && first >= 0x1f1e6 && first <= 0x1f1ff) return 2;
  let width = 0;
  let base = false;
  for (const ch of cluster) {
    const w = scalarWidth(ch.codePointAt(0)!);
    if (w === 2) return 2; // an emoji/CJK scalar dominates the cluster
    if (!base && w > 0) {
      width = w;
      base = true;
    }
  }
  return width;
}

/**
 * Approximate monospace display width of a string. Newlines are treated as
 * zero-width (callers pass single logical lines / cells).
 */
export function displayWidth(text: string): number {
  if (text === '') return 0;
  let total = 0;
  if (segmenter) {
    for (const { segment } of segmenter.segment(text)) {
      total += clusterWidth(segment);
    }
    return total;
  }
  for (const ch of text) {
    total += scalarWidth(ch.codePointAt(0)!);
  }
  return total;
}

/**
 * Split text into grapheme clusters (via `Intl.Segmenter` when available, else
 * Unicode scalar values). Used by the table wrapper so a hard break never splits
 * a surrogate pair or a combining sequence.
 */
export function segmentGraphemes(text: string): string[] {
  if (segmenter) {
    const out: string[] = [];
    for (const { segment } of segmenter.segment(text)) out.push(segment);
    return out;
  }
  return Array.from(text);
}

/** Right-pad `text` with spaces to `width` display columns (left-aligned). */
export function padEndDisplay(text: string, width: number): string {
  const pad = width - displayWidth(text);
  return pad > 0 ? text + ' '.repeat(pad) : text;
}

/** Left-pad `text` with spaces to `width` display columns (right-aligned). */
export function padStartDisplay(text: string, width: number): string {
  const pad = width - displayWidth(text);
  return pad > 0 ? ' '.repeat(pad) + text : text;
}

/** Pad `text` to `width` display columns centred (extra space favours the right). */
export function padCenterDisplay(text: string, width: number): string {
  const pad = width - displayWidth(text);
  if (pad <= 0) return text;
  const left = Math.floor(pad / 2);
  return ' '.repeat(left) + text + ' '.repeat(pad - left);
}
