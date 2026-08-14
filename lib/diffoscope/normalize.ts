/**
 * Normalization helpers and comparison lenses.
 *
 * Two distinct jobs live here, and it matters that they stay distinct:
 *
 *   - Whole-string normalizers (`normLineEndings`, `collapseWhitespace`, …) are
 *     used only to *diagnose* how two inputs relate ("identical except for line
 *     endings"). They are never written back to the inputs.
 *   - `lensKey` produces the comparison key for a single token under an active
 *     lens. The token's displayed text is always its original `value`; only its
 *     matching key changes. A lens is an interpretation, not a cleanup.
 */

import { classify } from '@/lib/inspector';
import { codePoints } from './tokenize';
import type { LensState, Token } from './types';

/** Collapse CRLF and lone CR to LF. */
export function normLineEndings(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

/** Case fold (locale-independent) for case-insensitive comparison. */
export function foldCase(text: string): string {
  return text.toLowerCase();
}

/** Unicode canonical composition. */
export function toNFC(text: string): string {
  return text.normalize('NFC');
}

/** Unicode compatibility composition — semantically lossy; label it as such. */
export function toNFKC(text: string): string {
  return text.normalize('NFKC');
}

/**
 * Whitespace for equivalence checks: JS `\s` minus U+FEFF. `\s` equates NBSP and
 * the other Unicode spaces (which is what we want), but it *also* matches the BOM
 * / zero-width no-break space — a genuinely invisible format character that
 * `stripInvisibles` owns. Letting whitespace-collapse eat it too would make the
 * two folds overlap and hide a BOM difference. `[^\S\uFEFF]` is "whitespace, but
 * not the BOM".
 */
const NON_BOM_WHITESPACE = new RegExp('[^\\S\\uFEFF]+', 'gu');

/**
 * Normalize whitespace for equivalence checks: unify line endings, collapse every
 * run of whitespace (other than the BOM) to a single space, and trim the ends.
 */
export function collapseWhitespace(text: string): string {
  return normLineEndings(text).replace(NON_BOM_WHITESPACE, ' ').replace(/^ | $/g, '');
}

/**
 * Fold visually-confusable characters onto the ASCII character they imitate
 * (curly quotes → straight, en/em dash → hyphen, Cyrillic/Greek homoglyphs → the
 * Latin letter they mimic), reusing the inspector's classification so the two
 * tools never disagree about what a code point is. Characters with no ASCII
 * look-alike are left untouched. `foldHomoglyphs` / `foldTypographicPunctuation`
 * restrict this to letters / punctuation respectively, so the verdict can tell a
 * homograph-spoofing letter apart from a curly quote.
 */
export function foldConfusables(text: string): string {
  let out = '';
  for (const { value } of codePoints(text)) {
    const cp = value.codePointAt(0)!;
    const looksLike = classify(cp)?.looksLike;
    out += looksLike ?? value;
  }
  return out;
}

const HOMOGLYPH_CATEGORIES: ReadonlySet<string> = new Set(['confusable-letter']);
const PUNCTUATION_CONFUSABLE_CATEGORIES: ReadonlySet<string> = new Set([
  'confusable-quote',
  'confusable-dash',
  'confusable-punctuation',
]);

function foldConfusablesIn(text: string, categories: ReadonlySet<string>): string {
  let out = '';
  for (const { value } of codePoints(text)) {
    const cp = value.codePointAt(0)!;
    const c = classify(cp);
    out += c?.looksLike && categories.has(c.category) ? c.looksLike : value;
  }
  return out;
}

/** Fold only look-alike *letters* (Cyrillic/Greek/full-width homoglyphs). */
export function foldHomoglyphs(text: string): string {
  return foldConfusablesIn(text, HOMOGLYPH_CATEGORIES);
}

/** Fold only look-alike *punctuation* (curly quotes, dashes, ellipsis, …). */
export function foldTypographicPunctuation(text: string): string {
  return foldConfusablesIn(text, PUNCTUATION_CONFUSABLE_CATEGORIES);
}

/** Categories the inspector reports that are genuinely invisible/zero-advance. */
const INVISIBLE_CATEGORIES = new Set([
  'zero-width',
  'soft-hyphen',
  'bom',
  'bidi',
  'variation-selector',
  'tag',
]);

/** True when a code point is an invisible formatting character worth folding out. */
export function isStrippableInvisible(cp: number): boolean {
  const category = classify(cp)?.category;
  return category !== undefined && INVISIBLE_CATEGORIES.has(category);
}

/** Remove invisible formatting characters (ZW*, BOM, soft hyphen, bidi, VS, tag). */
export function stripInvisibles(text: string): string {
  let out = '';
  for (const { value } of codePoints(text)) {
    if (!isStrippableInvisible(value.codePointAt(0)!)) out += value;
  }
  return out;
}

/** True when the whole string is whitespace (or empty). */
function isBlank(text: string): boolean {
  return text.length === 0 || /^\s+$/u.test(text);
}

/**
 * The comparison key for one token under the active lens. The order matters:
 * NFC first (so case folding and whitespace see canonical forms), then case,
 * then whitespace handling appropriate to the token's kind.
 */
export function lensKey(token: Token, lens: LensState): string {
  let key = token.value;
  if (lens.nfc) key = toNFC(key);
  if (lens.ignoreCase) key = foldCase(key);
  if (lens.ignoreWhitespace) {
    if (token.kind === 'space') {
      key = ' ';
    } else if (token.kind === 'line') {
      key = key.replace(/\s+/gu, ' ').trim();
    } else if (token.kind === 'grapheme' && isBlank(key)) {
      key = ' ';
    }
  }
  return key;
}

/** Compute the comparison keys for a token stream under a lens. */
export function lensKeys(tokens: Token[], lens: LensState): string[] {
  return tokens.map((token) => lensKey(token, lens));
}
