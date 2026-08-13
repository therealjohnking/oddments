/** Small formatting helpers shared across the inspector. */

/** Format a code point as the canonical `U+XXXX` (minimum four hex digits). */
export function formatCodePoint(codePoint: number): string {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, '0')}`;
}

/**
 * A short, safe-to-render label for a code point that has no friendlier name.
 * Uses caret notation for C0 controls (e.g. `^G` for BEL) since that is how
 * developers usually recognise them.
 */
export function fallbackAbbr(codePoint: number): string {
  if (codePoint <= 0x1f) {
    return `^${String.fromCharCode(codePoint + 0x40)}`;
  }
  if (codePoint === 0x7f) {
    return '^?';
  }
  return formatCodePoint(codePoint);
}

/** UTF-8 byte length of a string, matching how it would be stored/transmitted. */
export function utf8ByteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

/** Count Unicode code points (astral-safe), without allocating an array. */
export function countCodePoints(text: string): number {
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    count++;
    const code = text.charCodeAt(i);
    // Skip the trailing half of a surrogate pair.
    if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) i++;
    }
  }
  return count;
}

/**
 * Count user-perceived characters (grapheme clusters) when the runtime supports
 * `Intl.Segmenter`, falling back to the code-point count otherwise.
 */
export function countGraphemes(text: string): number {
  const Segmenter = (
    Intl as unknown as {
      Segmenter?: new (
        locale?: string,
        options?: { granularity: 'grapheme' },
      ) => { segment: (input: string) => Iterable<unknown> };
    }
  ).Segmenter;
  if (!Segmenter) return countCodePoints(text);
  const segmenter = new Segmenter(undefined, { granularity: 'grapheme' });
  let count = 0;
  for (const _ of segmenter.segment(text)) {
    void _;
    count++;
  }
  return count;
}
