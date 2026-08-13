import { CATEGORY_META, type CategoryId } from './categories';
import { fallbackAbbr } from './format';
import { NAMED_CHARACTERS } from './named-characters';

export interface Classification {
  category: CategoryId;
  name: string;
  /** Fully-resolved short marker text for the reveal view. */
  abbr: string;
  /** For confusables: the ASCII character this one imitates. */
  looksLike?: string;
}

// Precompiled Unicode property escapes. These are backed by the JS engine's
// Unicode database, so classification tracks the engine's Unicode version
// instead of a hand-maintained (and inevitably stale) code-point list.
const RE_BIDI = /\p{Bidi_Control}/u;
const RE_NONCHARACTER = /\p{Noncharacter_Code_Point}/u;
const RE_CONTROL = /\p{Cc}/u;
const RE_PRIVATE_USE = /\p{Co}/u;
const RE_FORMAT = /\p{Cf}/u;
const RE_DEFAULT_IGNORABLE = /\p{Default_Ignorable_Code_Point}/u;
const RE_SPACE_SEPARATOR = /\p{Zs}/u;
const RE_LINE_OR_PARA_SEP = /\p{Zl}|\p{Zp}/u;
const RE_WHITE_SPACE = /\p{White_Space}/u;

/** Characters handled structurally by the analyzer, never as findings here. */
function isStructural(cp: number): boolean {
  return cp === 0x09 || cp === 0x0a || cp === 0x0d || cp === 0x20;
}

function isVariationSelector(cp: number): boolean {
  return (
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    (cp >= 0xe0100 && cp <= 0xe01ef) ||
    (cp >= 0x180b && cp <= 0x180f)
  );
}

function isTagCharacter(cp: number): boolean {
  return cp >= 0xe0000 && cp <= 0xe007f;
}

function resolveAbbr(category: CategoryId, cp: number, tableAbbr?: string): string {
  if (tableAbbr) return tableAbbr;
  if (category === 'control') return fallbackAbbr(cp);
  return CATEGORY_META[category].abbr;
}

const GENERIC_NAMES: Partial<Record<CategoryId, string>> = {
  bidi: 'Bidirectional control',
  tag: 'Tag character',
  'variation-selector': 'Variation selector',
  noncharacter: 'Noncharacter',
  control: 'Control character',
  'private-use': 'Private-use character',
  'zero-width': 'Invisible format character',
  'unusual-space': 'Unicode space',
  'vertical-whitespace': 'Vertical whitespace',
};

function make(category: CategoryId, name: string, cp: number, looksLike?: string): Classification {
  return { category, name, abbr: resolveAbbr(category, cp), looksLike };
}

/**
 * Classify a single Unicode code point. Returns `null` for ordinary, visible
 * characters and for the structural whitespace (space, tab, LF, CR) that the
 * analyzer accounts for on its own.
 */
export function classify(cp: number): Classification | null {
  if (isStructural(cp)) return null;

  // 1. Curated table — nicest names, abbreviations, and "looks like" hints.
  const named = NAMED_CHARACTERS[cp];
  if (named) {
    return {
      category: named.category,
      name: named.name,
      abbr: resolveAbbr(named.category, cp, named.abbr),
      looksLike: named.looksLike,
    };
  }

  // 2. Unpaired surrogates: malformed UTF-16, worth surfacing loudly.
  if (cp >= 0xd800 && cp <= 0xdfff) {
    return { category: 'control', name: 'Unpaired surrogate', abbr: 'SUR' };
  }

  // 3. Fullwidth ASCII forms (U+FF01..U+FF5E) map 1:1 onto ASCII 0x21..0x7E.
  if (cp >= 0xff01 && cp <= 0xff5e) {
    const ascii = cp - 0xfee0;
    const asciiChar = String.fromCharCode(ascii);
    const isLetter = /[A-Za-z]/.test(asciiChar);
    return make(
      isLetter ? 'confusable-letter' : 'confusable-punctuation',
      `Fullwidth form of “${asciiChar}”`,
      cp,
      asciiChar,
    );
  }

  // 4. Property-driven fallback (ordering matters — most specific first).
  const s = String.fromCodePoint(cp);
  if (RE_BIDI.test(s)) return make('bidi', GENERIC_NAMES.bidi!, cp);
  if (isTagCharacter(cp)) return make('tag', GENERIC_NAMES.tag!, cp);
  if (isVariationSelector(cp))
    return make('variation-selector', GENERIC_NAMES['variation-selector']!, cp);
  if (RE_NONCHARACTER.test(s)) return make('noncharacter', GENERIC_NAMES.noncharacter!, cp);
  if (RE_CONTROL.test(s)) return make('control', GENERIC_NAMES.control!, cp);
  if (RE_PRIVATE_USE.test(s)) return make('private-use', GENERIC_NAMES['private-use']!, cp);
  if (RE_FORMAT.test(s) || RE_DEFAULT_IGNORABLE.test(s)) {
    return make('zero-width', GENERIC_NAMES['zero-width']!, cp);
  }
  if (RE_SPACE_SEPARATOR.test(s)) return make('unusual-space', GENERIC_NAMES['unusual-space']!, cp);
  if (RE_LINE_OR_PARA_SEP.test(s) || RE_WHITE_SPACE.test(s)) {
    return make('vertical-whitespace', GENERIC_NAMES['vertical-whitespace']!, cp);
  }

  return null;
}
