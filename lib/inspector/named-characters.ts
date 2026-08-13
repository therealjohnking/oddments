import type { CategoryId } from './categories';

/**
 * A curated table of friendly metadata for the specific code points people
 * actually run into. This is deliberately NOT exhaustive: detection falls back
 * to Unicode property escapes (see `classify.ts`) for everything not listed
 * here. The table's job is nicer names, short marker abbreviations, "looks
 * like" hints for confusables, and the conservative clean-up target used by the
 * cleaning transforms.
 *
 * Confusable letters are a small, high-confidence subset of the (thousands of)
 * UTS #39 confusables — enough to catch the common Cyrillic/Greek homoglyph
 * tricks without shipping the full database. This limitation is documented in
 * the README.
 */
export interface NamedChar {
  name: string;
  category: CategoryId;
  /** Short marker text shown in the reveal view (falls back to a code point). */
  abbr?: string;
  /** The ASCII character this one imitates (confusables only). */
  looksLike?: string;
  /** Conservative replacement used by the relevant cleaning transform. */
  cleanTo?: string;
}

const SPACE = ' ';
const SQUOTE = "'";
const DQUOTE = '"';
const HYPHEN = '-';

export const NAMED_CHARACTERS: Record<number, NamedChar> = {
  // ── Unusual spaces (Zs other than the ASCII space) ───────────────────────
  0x00a0: { name: 'No-break space', category: 'unusual-space', abbr: 'NBSP', cleanTo: SPACE },
  0x1680: { name: 'Ogham space mark', category: 'unusual-space', abbr: 'OGSP', cleanTo: SPACE },
  0x2000: { name: 'En quad', category: 'unusual-space', abbr: 'NQSP', cleanTo: SPACE },
  0x2001: { name: 'Em quad', category: 'unusual-space', abbr: 'MQSP', cleanTo: SPACE },
  0x2002: { name: 'En space', category: 'unusual-space', abbr: 'ENSP', cleanTo: SPACE },
  0x2003: { name: 'Em space', category: 'unusual-space', abbr: 'EMSP', cleanTo: SPACE },
  0x2004: { name: 'Three-per-em space', category: 'unusual-space', abbr: '3/M', cleanTo: SPACE },
  0x2005: { name: 'Four-per-em space', category: 'unusual-space', abbr: '4/M', cleanTo: SPACE },
  0x2006: { name: 'Six-per-em space', category: 'unusual-space', abbr: '6/M', cleanTo: SPACE },
  0x2007: { name: 'Figure space', category: 'unusual-space', abbr: 'FIGSP', cleanTo: SPACE },
  0x2008: { name: 'Punctuation space', category: 'unusual-space', abbr: 'PUNSP', cleanTo: SPACE },
  0x2009: { name: 'Thin space', category: 'unusual-space', abbr: 'THSP', cleanTo: SPACE },
  0x200a: { name: 'Hair space', category: 'unusual-space', abbr: 'HRSP', cleanTo: SPACE },
  0x202f: {
    name: 'Narrow no-break space',
    category: 'unusual-space',
    abbr: 'NNBSP',
    cleanTo: SPACE,
  },
  0x205f: {
    name: 'Medium mathematical space',
    category: 'unusual-space',
    abbr: 'MMSP',
    cleanTo: SPACE,
  },
  0x3000: { name: 'Ideographic space', category: 'unusual-space', abbr: 'IDSP', cleanTo: SPACE },

  // ── Vertical / separator whitespace ──────────────────────────────────────
  0x000b: { name: 'Line tabulation (vertical tab)', category: 'vertical-whitespace', abbr: 'VT' },
  0x000c: { name: 'Form feed', category: 'vertical-whitespace', abbr: 'FF' },
  0x0085: { name: 'Next line (NEL)', category: 'vertical-whitespace', abbr: 'NEL' },
  0x2028: { name: 'Line separator', category: 'vertical-whitespace', abbr: 'LSEP' },
  0x2029: { name: 'Paragraph separator', category: 'vertical-whitespace', abbr: 'PSEP' },

  // ── Zero-width / invisible format characters ─────────────────────────────
  0x200b: { name: 'Zero-width space', category: 'zero-width', abbr: 'ZWSP' },
  0x200c: { name: 'Zero-width non-joiner', category: 'zero-width', abbr: 'ZWNJ' },
  0x200d: { name: 'Zero-width joiner', category: 'zero-width', abbr: 'ZWJ' },
  0x2060: { name: 'Word joiner', category: 'zero-width', abbr: 'WJ' },
  0x2061: { name: 'Function application', category: 'zero-width', abbr: 'f()' },
  0x2062: { name: 'Invisible times', category: 'zero-width', abbr: '(×)' },
  0x2063: { name: 'Invisible separator', category: 'zero-width', abbr: '(,)' },
  0x2064: { name: 'Invisible plus', category: 'zero-width', abbr: '(+)' },
  0x034f: { name: 'Combining grapheme joiner', category: 'zero-width', abbr: 'CGJ' },
  0x180e: { name: 'Mongolian vowel separator', category: 'zero-width', abbr: 'MVS' },
  0xfeff: { name: 'Zero-width no-break space', category: 'zero-width', abbr: 'ZWNBSP' },

  // ── Blank / filler (occupy width, paint no ink) ──────────────────────────
  0x115f: { name: 'Hangul choseong filler', category: 'blank', abbr: 'HCF' },
  0x1160: { name: 'Hangul jungseong filler', category: 'blank', abbr: 'HJF' },
  0x3164: { name: 'Hangul filler', category: 'blank', abbr: 'HF' },
  0xffa0: { name: 'Halfwidth Hangul filler', category: 'blank', abbr: 'HHF' },
  0x2800: { name: 'Braille pattern blank', category: 'blank', abbr: 'BRZ' },

  // ── Soft hyphen ──────────────────────────────────────────────────────────
  0x00ad: { name: 'Soft hyphen', category: 'soft-hyphen', abbr: 'SHY' },

  // ── Bidirectional controls (Trojan Source) ───────────────────────────────
  0x061c: { name: 'Arabic letter mark', category: 'bidi', abbr: 'ALM' },
  0x200e: { name: 'Left-to-right mark', category: 'bidi', abbr: 'LRM' },
  0x200f: { name: 'Right-to-left mark', category: 'bidi', abbr: 'RLM' },
  0x202a: { name: 'Left-to-right embedding', category: 'bidi', abbr: 'LRE' },
  0x202b: { name: 'Right-to-left embedding', category: 'bidi', abbr: 'RLE' },
  0x202c: { name: 'Pop directional formatting', category: 'bidi', abbr: 'PDF' },
  0x202d: { name: 'Left-to-right override', category: 'bidi', abbr: 'LRO' },
  0x202e: { name: 'Right-to-left override', category: 'bidi', abbr: 'RLO' },
  0x2066: { name: 'Left-to-right isolate', category: 'bidi', abbr: 'LRI' },
  0x2067: { name: 'Right-to-left isolate', category: 'bidi', abbr: 'RLI' },
  0x2068: { name: 'First strong isolate', category: 'bidi', abbr: 'FSI' },
  0x2069: { name: 'Pop directional isolate', category: 'bidi', abbr: 'PDI' },

  // ── Variation selectors (nicer names for the common two) ─────────────────
  0xfe0e: {
    name: 'Variation selector-15 (text style)',
    category: 'variation-selector',
    abbr: 'VS15',
  },
  0xfe0f: {
    name: 'Variation selector-16 (emoji style)',
    category: 'variation-selector',
    abbr: 'VS16',
  },

  // ── Replacement / object markers ─────────────────────────────────────────
  0xfffc: { name: 'Object replacement character', category: 'replacement', abbr: 'OBJ' },
  0xfffd: { name: 'Replacement character', category: 'replacement', abbr: 'REPL' },

  // ── Confusable quotes / apostrophes / primes ─────────────────────────────
  0x2018: {
    name: 'Left single quotation mark',
    category: 'confusable-quote',
    looksLike: SQUOTE,
    cleanTo: SQUOTE,
  },
  0x2019: {
    name: 'Right single quotation mark',
    category: 'confusable-quote',
    looksLike: SQUOTE,
    cleanTo: SQUOTE,
  },
  0x201c: {
    name: 'Left double quotation mark',
    category: 'confusable-quote',
    looksLike: DQUOTE,
    cleanTo: DQUOTE,
  },
  0x201d: {
    name: 'Right double quotation mark',
    category: 'confusable-quote',
    looksLike: DQUOTE,
    cleanTo: DQUOTE,
  },
  0x201a: { name: 'Single low-9 quotation mark', category: 'confusable-quote', looksLike: ',' },
  0x201b: {
    name: 'Single high-reversed-9 quotation mark',
    category: 'confusable-quote',
    looksLike: SQUOTE,
  },
  0x201e: { name: 'Double low-9 quotation mark', category: 'confusable-quote', looksLike: DQUOTE },
  0x201f: {
    name: 'Double high-reversed-9 quotation mark',
    category: 'confusable-quote',
    looksLike: DQUOTE,
  },
  0x2032: { name: 'Prime', category: 'confusable-quote', looksLike: SQUOTE },
  0x2033: { name: 'Double prime', category: 'confusable-quote', looksLike: DQUOTE },
  0x2035: { name: 'Reversed prime', category: 'confusable-quote', looksLike: SQUOTE },
  0x2039: {
    name: 'Single left angle quotation mark',
    category: 'confusable-quote',
    looksLike: '<',
  },
  0x203a: {
    name: 'Single right angle quotation mark',
    category: 'confusable-quote',
    looksLike: '>',
  },
  0x00ab: {
    name: 'Left double angle quotation mark (guillemet)',
    category: 'confusable-quote',
    looksLike: DQUOTE,
  },
  0x00bb: {
    name: 'Right double angle quotation mark (guillemet)',
    category: 'confusable-quote',
    looksLike: DQUOTE,
  },
  0x02bc: { name: 'Modifier letter apostrophe', category: 'confusable-quote', looksLike: SQUOTE },
  0x02bb: {
    name: 'Modifier letter turned comma (ʻokina)',
    category: 'confusable-quote',
    looksLike: SQUOTE,
  },
  0x00b4: { name: 'Acute accent', category: 'confusable-quote', looksLike: SQUOTE },

  // ── Confusable hyphens / dashes / minus ──────────────────────────────────
  0x2010: { name: 'Hyphen', category: 'confusable-dash', looksLike: HYPHEN, cleanTo: HYPHEN },
  0x2011: {
    name: 'Non-breaking hyphen',
    category: 'confusable-dash',
    looksLike: HYPHEN,
    cleanTo: HYPHEN,
  },
  0x2012: { name: 'Figure dash', category: 'confusable-dash', looksLike: HYPHEN, cleanTo: HYPHEN },
  0x2013: { name: 'En dash', category: 'confusable-dash', looksLike: HYPHEN, cleanTo: HYPHEN },
  0x2014: { name: 'Em dash', category: 'confusable-dash', looksLike: HYPHEN, cleanTo: HYPHEN },
  0x2015: {
    name: 'Horizontal bar',
    category: 'confusable-dash',
    looksLike: HYPHEN,
    cleanTo: HYPHEN,
  },
  0x2212: { name: 'Minus sign', category: 'confusable-dash', looksLike: HYPHEN, cleanTo: HYPHEN },
  0xff0d: {
    name: 'Fullwidth hyphen-minus',
    category: 'confusable-dash',
    looksLike: HYPHEN,
    cleanTo: HYPHEN,
  },
  0x2043: { name: 'Hyphen bullet', category: 'confusable-dash', looksLike: HYPHEN },
  0x2e3a: { name: 'Two-em dash', category: 'confusable-dash', looksLike: '--' },
  0x2e3b: { name: 'Three-em dash', category: 'confusable-dash', looksLike: '---' },

  // ── Confusable punctuation (detect only) ─────────────────────────────────
  0x2026: { name: 'Horizontal ellipsis', category: 'confusable-punctuation', looksLike: '...' },
  0x2024: { name: 'One dot leader', category: 'confusable-punctuation', looksLike: '.' },
  0x2044: { name: 'Fraction slash', category: 'confusable-punctuation', looksLike: '/' },
  0x2215: { name: 'Division slash', category: 'confusable-punctuation', looksLike: '/' },
  0x037e: { name: 'Greek question mark', category: 'confusable-punctuation', looksLike: ';' },
  0x0387: { name: 'Greek ano teleia', category: 'confusable-punctuation', looksLike: '·' },
  0x2236: { name: 'Ratio', category: 'confusable-punctuation', looksLike: ':' },
  0xa789: { name: 'Modifier letter colon', category: 'confusable-punctuation', looksLike: ':' },
  0x00b7: { name: 'Middle dot', category: 'confusable-punctuation', looksLike: '·' },
  0x2027: { name: 'Hyphenation point', category: 'confusable-punctuation', looksLike: '·' },

  // ── Confusable letters (high-confidence Cyrillic/Greek homoglyphs) ────────
  // Cyrillic, lowercase
  0x0430: { name: 'Cyrillic small letter a', category: 'confusable-letter', looksLike: 'a' },
  0x0435: { name: 'Cyrillic small letter ie', category: 'confusable-letter', looksLike: 'e' },
  0x043e: { name: 'Cyrillic small letter o', category: 'confusable-letter', looksLike: 'o' },
  0x0440: { name: 'Cyrillic small letter er', category: 'confusable-letter', looksLike: 'p' },
  0x0441: { name: 'Cyrillic small letter es', category: 'confusable-letter', looksLike: 'c' },
  0x0443: { name: 'Cyrillic small letter u', category: 'confusable-letter', looksLike: 'y' },
  0x0445: { name: 'Cyrillic small letter ha', category: 'confusable-letter', looksLike: 'x' },
  0x0456: {
    name: 'Cyrillic small letter byelorussian-ukrainian i',
    category: 'confusable-letter',
    looksLike: 'i',
  },
  0x0458: { name: 'Cyrillic small letter je', category: 'confusable-letter', looksLike: 'j' },
  0x0455: { name: 'Cyrillic small letter dze', category: 'confusable-letter', looksLike: 's' },
  // Cyrillic, uppercase
  0x0410: { name: 'Cyrillic capital letter a', category: 'confusable-letter', looksLike: 'A' },
  0x0412: { name: 'Cyrillic capital letter ve', category: 'confusable-letter', looksLike: 'B' },
  0x0415: { name: 'Cyrillic capital letter ie', category: 'confusable-letter', looksLike: 'E' },
  0x041a: { name: 'Cyrillic capital letter ka', category: 'confusable-letter', looksLike: 'K' },
  0x041c: { name: 'Cyrillic capital letter em', category: 'confusable-letter', looksLike: 'M' },
  0x041d: { name: 'Cyrillic capital letter en', category: 'confusable-letter', looksLike: 'H' },
  0x041e: { name: 'Cyrillic capital letter o', category: 'confusable-letter', looksLike: 'O' },
  0x0420: { name: 'Cyrillic capital letter er', category: 'confusable-letter', looksLike: 'P' },
  0x0421: { name: 'Cyrillic capital letter es', category: 'confusable-letter', looksLike: 'C' },
  0x0422: { name: 'Cyrillic capital letter te', category: 'confusable-letter', looksLike: 'T' },
  0x0425: { name: 'Cyrillic capital letter ha', category: 'confusable-letter', looksLike: 'X' },
  // Greek
  0x03bf: { name: 'Greek small letter omicron', category: 'confusable-letter', looksLike: 'o' },
  0x0391: { name: 'Greek capital letter alpha', category: 'confusable-letter', looksLike: 'A' },
  0x0392: { name: 'Greek capital letter beta', category: 'confusable-letter', looksLike: 'B' },
  0x0395: { name: 'Greek capital letter epsilon', category: 'confusable-letter', looksLike: 'E' },
  0x0397: { name: 'Greek capital letter eta', category: 'confusable-letter', looksLike: 'H' },
  0x0399: { name: 'Greek capital letter iota', category: 'confusable-letter', looksLike: 'I' },
  0x039a: { name: 'Greek capital letter kappa', category: 'confusable-letter', looksLike: 'K' },
  0x039c: { name: 'Greek capital letter mu', category: 'confusable-letter', looksLike: 'M' },
  0x039d: { name: 'Greek capital letter nu', category: 'confusable-letter', looksLike: 'N' },
  0x039f: { name: 'Greek capital letter omicron', category: 'confusable-letter', looksLike: 'O' },
  0x03a1: { name: 'Greek capital letter rho', category: 'confusable-letter', looksLike: 'P' },
  0x03a4: { name: 'Greek capital letter tau', category: 'confusable-letter', looksLike: 'T' },
  0x03a7: { name: 'Greek capital letter chi', category: 'confusable-letter', looksLike: 'X' },
  0x0396: { name: 'Greek capital letter zeta', category: 'confusable-letter', looksLike: 'Z' },
};

/** Code points that a "convert unusual spaces" style transform may touch. */
export const NBSP_CODE_POINTS: ReadonlySet<number> = new Set([0x00a0, 0x202f]);
