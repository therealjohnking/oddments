import { countCodePoints } from './format';
import { NAMED_CHARACTERS, NBSP_CODE_POINTS } from './named-characters';

export type TransformRisk = 'safe' | 'moderate' | 'destructive';

export type TransformId =
  | 'strip-bom'
  | 'normalize-line-endings'
  | 'nfc-normalize'
  | 'normalize-nbsp'
  | 'normalize-unicode-spaces'
  | 'smart-quotes'
  | 'dashes-to-hyphen'
  | 'remove-zero-width'
  | 'remove-zwj-zwnj'
  | 'remove-controls'
  | 'remove-bidi'
  | 'remove-variation-selectors'
  | 'remove-tags'
  | 'remove-soft-hyphens'
  | 'strip-trailing-whitespace'
  | 'trim-document-edges';

export interface TransformDef {
  id: TransformId;
  label: string;
  description: string;
  risk: TransformRisk;
  defaultOn: boolean;
  /**
   * A one-line caution about when this transform would change meaningful text.
   * Undefined for the two "safe" transforms.
   */
  caution?: string;
  /** Count of characters in `text` this transform would change or remove. */
  count(text: string): number;
  /** Apply the transform. Every transform is idempotent. */
  apply(text: string): string;
}

// U+FEFF (BOM / zero-width no-break space), kept as an escape so it is never a
// literal invisible character in this source file.
const FEFF = '\uFEFF';

function bmpCharClass(codePoints: Iterable<number>): string {
  let out = '';
  for (const cp of codePoints) {
    out += `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  }
  return out;
}

function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function sumMatchLengths(text: string, re: RegExp): number {
  const matches = text.match(re);
  if (!matches) return 0;
  return matches.reduce((total, m) => total + m.length, 0);
}

function cleanTargets(predicate: (cp: number) => boolean): Map<number, string> {
  const map = new Map<number, string>();
  for (const [cp, entry] of Object.entries(NAMED_CHARACTERS)) {
    const codePoint = Number(cp);
    if (entry.cleanTo !== undefined && predicate(codePoint)) {
      map.set(codePoint, entry.cleanTo);
    }
  }
  return map;
}

const QUOTE_MAP = cleanTargets((cp) => NAMED_CHARACTERS[cp]?.category === 'confusable-quote');
const DASH_MAP = cleanTargets((cp) => NAMED_CHARACTERS[cp]?.category === 'confusable-dash');

const UNUSUAL_SPACE_CPS: number[] = Object.keys(NAMED_CHARACTERS)
  .map(Number)
  .filter((cp) => NAMED_CHARACTERS[cp]?.category === 'unusual-space');
const OTHER_SPACE_CPS = UNUSUAL_SPACE_CPS.filter((cp) => !NBSP_CODE_POINTS.has(cp));

const RE_NBSP = new RegExp(`[${bmpCharClass(NBSP_CODE_POINTS)}]`, 'g');
const RE_OTHER_SPACE = new RegExp(`[${bmpCharClass(OTHER_SPACE_CPS)}]`, 'g');
const RE_QUOTES = new RegExp(`[${bmpCharClass(QUOTE_MAP.keys())}]`, 'g');
const RE_DASHES = new RegExp(`[${bmpCharClass(DASH_MAP.keys())}]`, 'g');
// C0/C1 controls excluding tab (09), line feed (0A), carriage return (0D).
const RE_CONTROLS = /[\0-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g;
const RE_TRAILING = /[ \t]+(?=\r\n|\r|\n|$)/g;
// ZWSP, WJ, invisible math operators, Mongolian vowel separator. NOT ZWJ/ZWNJ.
const RE_ZERO_WIDTH = /[\u200B\u2060\u2061-\u2064\u180E]/g;
const RE_ZWJ_ZWNJ = /[\u200C\u200D]/g;
const RE_SOFT_HYPHEN = /\u00AD/g;
const RE_FEFF = /\uFEFF/g;
const RE_BIDI = /\p{Bidi_Control}/gu;
const RE_VARIATION = /[\u{FE00}-\u{FE0F}\u{180B}-\u{180F}\u{E0100}-\u{E01EF}]/gu;
const RE_TAGS = /[\u{E0000}-\u{E007F}]/gu;

function replaceFromMap(text: string, re: RegExp, map: Map<number, string>): string {
  return text.replace(re, (ch) => map.get(ch.codePointAt(0) ?? -1) ?? ch);
}

/** Count interior (non-leading) U+FEFF occurrences. */
function countInteriorFeff(text: string): number {
  const total = countMatches(text, RE_FEFF);
  return text.startsWith(FEFF) ? total - 1 : total;
}

function nfcAffected(text: string): number {
  const normalized = text.normalize('NFC');
  if (normalized === text) return 0;
  const delta = countCodePoints(text) - countCodePoints(normalized);
  if (delta > 0) return delta;
  let singletons = 0;
  for (const ch of text) {
    if (ch.normalize('NFC') !== ch) singletons += 1;
  }
  return singletons > 0 ? singletons : Math.max(1, Math.abs(delta));
}

function leadingTrailingTrimCount(text: string): number {
  return text.length - text.trim().length;
}

/**
 * All transforms, keyed by id. The `PIPELINE_ORDER` array below fixes the order
 * in which enabled transforms are applied (see `applyTransforms`).
 */
export const TRANSFORMS: Record<TransformId, TransformDef> = {
  'normalize-line-endings': {
    id: 'normalize-line-endings',
    label: 'Normalize line endings to LF',
    description: 'Rewrite Windows (CRLF) and classic-Mac (CR) line breaks to Unix (LF).',
    risk: 'safe',
    defaultOn: true,
    count: (t) => countMatches(t, /\r/g),
    apply: (t) => t.replace(/\r\n?/g, '\n'),
  },
  'strip-trailing-whitespace': {
    id: 'strip-trailing-whitespace',
    label: 'Strip trailing whitespace',
    description: 'Remove spaces and tabs at the end of every line.',
    risk: 'safe',
    defaultOn: true,
    count: (t) => sumMatchLengths(t, RE_TRAILING),
    apply: (t) => t.replace(RE_TRAILING, ''),
  },
  'strip-bom': {
    id: 'strip-bom',
    label: 'Strip byte-order mark',
    description: 'Remove a single U+FEFF byte-order mark from the very start of the text.',
    risk: 'moderate',
    defaultOn: false,
    caution: 'Some tools (notably Excel importing CSV) rely on the BOM to detect UTF-8.',
    count: (t) => (t.startsWith(FEFF) ? 1 : 0),
    apply: (t) => (t.startsWith(FEFF) ? t.slice(1) : t),
  },
  'normalize-nbsp': {
    id: 'normalize-nbsp',
    label: 'Convert no-break spaces to spaces',
    description:
      'Replace no-break space (U+00A0) and narrow no-break space (U+202F) with a normal space.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'No-break spaces deliberately hold values together (10 kg, 1 000) and set French punctuation spacing.',
    count: (t) => countMatches(t, RE_NBSP),
    apply: (t) => t.replace(RE_NBSP, ' '),
  },
  'normalize-unicode-spaces': {
    id: 'normalize-unicode-spaces',
    label: 'Convert unusual Unicode spaces to spaces',
    description:
      'Replace en/em/thin/hair/figure/ideographic and other Unicode spaces with a normal space.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'Ideographic space is a normal full-width space in CJK; figure space aligns digits in tables.',
    count: (t) => countMatches(t, RE_OTHER_SPACE),
    apply: (t) => t.replace(RE_OTHER_SPACE, ' '),
  },
  'remove-zero-width': {
    id: 'remove-zero-width',
    label: 'Remove zero-width characters',
    description:
      'Delete zero-width space, word joiner, the invisible math operators, and interior zero-width no-break spaces. Leaves ZWJ/ZWNJ alone.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'Zero-width space marks word boundaries in Thai/Khmer/Lao; it is also used as an invisible watermark you may want to keep as evidence.',
    count: (t) => countMatches(t, RE_ZERO_WIDTH) + countInteriorFeff(t),
    apply: (t) => {
      const hasLeadingBom = t.startsWith(FEFF);
      const body = hasLeadingBom ? t.slice(1) : t;
      const cleaned = body.replace(RE_ZERO_WIDTH, '').replace(RE_FEFF, '');
      return (hasLeadingBom ? FEFF : '') + cleaned;
    },
  },
  'remove-soft-hyphens': {
    id: 'remove-soft-hyphens',
    label: 'Remove soft hyphens',
    description: 'Delete soft hyphens (U+00AD), the invisible "break here if needed" hint.',
    risk: 'moderate',
    defaultOn: false,
    caution: 'Soft hyphens carry intended hyphenation points for justified/reflowed text.',
    count: (t) => countMatches(t, RE_SOFT_HYPHEN),
    apply: (t) => t.replace(RE_SOFT_HYPHEN, ''),
  },
  'remove-controls': {
    id: 'remove-controls',
    label: 'Remove control characters',
    description: 'Delete C0/C1 control characters, keeping tab, line feed, and carriage return.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'In text mis-decoded from a legacy 8-bit encoding, bytes in the C1 range may be real data.',
    count: (t) => countMatches(t, RE_CONTROLS),
    apply: (t) => t.replace(RE_CONTROLS, ''),
  },
  'remove-tags': {
    id: 'remove-tags',
    label: 'Remove tag characters',
    description: 'Delete Plane-14 tag characters (U+E0000–U+E007F) used for "ASCII smuggling".',
    risk: 'moderate',
    defaultOn: false,
    caution: 'Tag characters are legitimate only inside emoji subdivision-flag sequences.',
    count: (t) => countMatches(t, RE_TAGS),
    apply: (t) => t.replace(RE_TAGS, ''),
  },
  'smart-quotes': {
    id: 'smart-quotes',
    label: 'Convert curly quotes to straight',
    description: 'Replace “ ” ‘ ’ with straight ASCII " and \'.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'Destroys typographic intent and corrupts German „…“ / French «…» quoting and the apostrophe-as-letter.',
    count: (t) => countMatches(t, RE_QUOTES),
    apply: (t) => replaceFromMap(t, RE_QUOTES, QUOTE_MAP),
  },
  'nfc-normalize': {
    id: 'nfc-normalize',
    label: 'Unicode normalize (NFC)',
    description:
      'Apply NFC canonical composition so equivalent sequences share one representation.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'Changes the underlying bytes, so it breaks exact-byte comparisons, hashes, and signatures. (NFKC, which is lossy, is deliberately not offered.)',
    count: (t) => nfcAffected(t),
    apply: (t) => t.normalize('NFC'),
  },
  'trim-document-edges': {
    id: 'trim-document-edges',
    label: 'Trim leading/trailing whitespace (whole document)',
    description: 'Remove whitespace and blank lines at the very start and very end of the text.',
    risk: 'moderate',
    defaultOn: false,
    caution:
      'Can delete a required final newline, or a leading blank line that separates headers from a body.',
    count: (t) => leadingTrailingTrimCount(t),
    apply: (t) => t.trim(),
  },
  'remove-zwj-zwnj': {
    id: 'remove-zwj-zwnj',
    label: 'Remove zero-width joiner / non-joiner',
    description: 'Delete ZWJ (U+200D) and ZWNJ (U+200C).',
    risk: 'destructive',
    defaultOn: false,
    caution:
      'These are NOT junk: ZWJ binds emoji sequences and both are required spelling in Persian/Arabic and Indic scripts.',
    count: (t) => countMatches(t, RE_ZWJ_ZWNJ),
    apply: (t) => t.replace(RE_ZWJ_ZWNJ, ''),
  },
  'remove-bidi': {
    id: 'remove-bidi',
    label: 'Remove bidirectional controls',
    description: 'Delete bidirectional formatting/override/isolate characters.',
    risk: 'destructive',
    defaultOn: false,
    caution:
      'Essential for correct display of mixed-direction (Arabic/Hebrew + Latin) text; removal scrambles visual order.',
    count: (t) => countMatches(t, RE_BIDI),
    apply: (t) => t.replace(RE_BIDI, ''),
  },
  'remove-variation-selectors': {
    id: 'remove-variation-selectors',
    label: 'Remove variation selectors',
    description:
      'Delete variation selectors (VS1–VS16, the supplement, and Mongolian free selectors).',
    risk: 'destructive',
    defaultOn: false,
    caution:
      'VS16 selects emoji presentation (heart → text heart) and CJK selectors pick the correct glyph in names.',
    count: (t) => countMatches(t, RE_VARIATION),
    apply: (t) => t.replace(RE_VARIATION, ''),
  },
  'dashes-to-hyphen': {
    id: 'dashes-to-hyphen',
    label: 'Convert dashes to hyphen',
    description: 'Replace en dash, em dash, minus sign, and related dashes with an ASCII hyphen.',
    risk: 'destructive',
    defaultOn: false,
    caution:
      'Flattens meaningful distinctions: en dash marks ranges, em dash is punctuation, minus is a math operator.',
    count: (t) => countMatches(t, RE_DASHES),
    apply: (t) => replaceFromMap(t, RE_DASHES, DASH_MAP),
  },
};

/**
 * The order in which enabled transforms are applied. BOM and line endings come
 * first, then normalization, then per-character substitutions and removals,
 * with whitespace trimming last so any converted trailing space is also caught.
 */
export const PIPELINE_ORDER: TransformId[] = [
  'strip-bom',
  'normalize-line-endings',
  'nfc-normalize',
  'normalize-nbsp',
  'normalize-unicode-spaces',
  'smart-quotes',
  'dashes-to-hyphen',
  'remove-zero-width',
  'remove-zwj-zwnj',
  'remove-controls',
  'remove-bidi',
  'remove-variation-selectors',
  'remove-tags',
  'remove-soft-hyphens',
  'strip-trailing-whitespace',
  'trim-document-edges',
];

/** All transforms in a stable display order (grouped safe → moderate → destructive). */
export const TRANSFORM_LIST: TransformDef[] = (
  ['safe', 'moderate', 'destructive'] as TransformRisk[]
).flatMap((risk) => PIPELINE_ORDER.map((id) => TRANSFORMS[id]).filter((t) => t.risk === risk));

export function defaultEnabledTransforms(): Set<TransformId> {
  return new Set(TRANSFORM_LIST.filter((t) => t.defaultOn).map((t) => t.id));
}

export interface CleanResult {
  text: string;
  changed: boolean;
  /** Net change in code-point length (negative means characters were removed). */
  codePointDelta: number;
}

/** Apply the enabled transforms in pipeline order. */
export function applyTransforms(input: string, enabled: ReadonlySet<TransformId>): CleanResult {
  let text = input;
  for (const id of PIPELINE_ORDER) {
    if (enabled.has(id)) {
      text = TRANSFORMS[id].apply(text);
    }
  }
  return {
    text,
    changed: text !== input,
    codePointDelta: countCodePoints(text) - countCodePoints(input),
  };
}
