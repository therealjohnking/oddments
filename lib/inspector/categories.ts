/**
 * The category taxonomy for the Invisible Character Inspector.
 *
 * Categories are intentionally coarse and human-facing. The *detection* of which
 * category a code point belongs to (see `classify.ts`) is driven primarily by
 * Unicode property escapes (`\p{...}`) so the tool stays correct as the engine's
 * Unicode version advances, rather than by hand-maintained code-point lists.
 */

export type Severity = 'info' | 'notice' | 'warning' | 'danger';

/** Numeric ordering so we can sort "most alarming first". */
export const SEVERITY_RANK: Record<Severity, number> = {
  danger: 3,
  warning: 2,
  notice: 1,
  info: 0,
};

export const CATEGORY_IDS = [
  // whitespace group
  'tab',
  'unusual-space',
  'vertical-whitespace',
  // invisible / control group
  'zero-width',
  'soft-hyphen',
  'bom',
  'bidi',
  'control',
  'variation-selector',
  'tag',
  'private-use',
  'noncharacter',
  'blank',
  'replacement',
  // confusable (visible but deceptive) group
  'confusable-quote',
  'confusable-dash',
  'confusable-punctuation',
  'confusable-letter',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

export type CategoryGroup = 'whitespace' | 'invisible' | 'confusable';

/** How a finding of this category is drawn in the reveal view. */
export type RenderStyle =
  /** An abbreviation pill standing in for an invisible / zero-width character. */
  | 'pill'
  /** A whitespace substitute glyph (the classic "show invisibles" marker). */
  | 'glyph'
  /** The real, visible glyph kept in place but underlined/annotated. */
  | 'annotate';

export interface CategoryMeta {
  id: CategoryId;
  label: string;
  /** One-line, plain-language explanation shown in the findings UI. */
  description: string;
  severity: Severity;
  group: CategoryGroup;
  render: RenderStyle;
  /**
   * True when the character paints no ink (or is otherwise genuinely hard to
   * see). False for "confusable" characters, which are visible but deceptive.
   */
  invisible: boolean;
  /** Fallback marker text when a specific character has no abbreviation. */
  abbr: string;
  /** Substitute glyph for whitespace-style markers. */
  glyph?: string;
}

export const GROUP_LABELS: Record<CategoryGroup, string> = {
  whitespace: 'Whitespace',
  invisible: 'Hidden & control',
  confusable: 'Confusable',
};

export const CATEGORY_META: Record<CategoryId, CategoryMeta> = {
  tab: {
    id: 'tab',
    label: 'Tab',
    description: 'Horizontal tab (U+0009). Often mixed with spaces in indentation.',
    severity: 'info',
    group: 'whitespace',
    render: 'glyph',
    invisible: false,
    abbr: 'TAB',
    glyph: '→',
  },
  'unusual-space': {
    id: 'unusual-space',
    label: 'Unusual space',
    description:
      'A Unicode space that is not the ordinary ASCII space — it looks like a gap but behaves differently (non-breaking, wider, narrower).',
    severity: 'warning',
    group: 'whitespace',
    render: 'glyph',
    invisible: false,
    abbr: 'SP',
    glyph: '·',
  },
  'vertical-whitespace': {
    id: 'vertical-whitespace',
    label: 'Vertical / separator whitespace',
    description:
      'Rarely-typed whitespace such as vertical tab, form feed, next line, and the line/paragraph separators (U+2028/U+2029).',
    severity: 'warning',
    group: 'whitespace',
    render: 'pill',
    invisible: true,
    abbr: 'VWS',
  },
  'zero-width': {
    id: 'zero-width',
    label: 'Zero-width / format',
    description:
      'An invisible formatting character with no width — joiners, zero-width spaces, and other format controls. Legitimate in some scripts and emoji, but also used to hide or watermark text.',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'ZW',
  },
  'soft-hyphen': {
    id: 'soft-hyphen',
    label: 'Soft hyphen',
    description:
      'A conditional hyphen (U+00AD) that is invisible unless a line breaks at that point. Frequently hides inside words copied from justified text.',
    severity: 'notice',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'SHY',
  },
  bom: {
    id: 'bom',
    label: 'Byte-order mark',
    description:
      'A leading U+FEFF byte-order mark. Content-free at the very start of text, but it can trip up parsers and diffing.',
    severity: 'notice',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'BOM',
  },
  bidi: {
    id: 'bidi',
    label: 'Bidirectional control',
    description:
      'An invisible direction-control character. These can reorder how text is displayed versus how it is stored — the basis of the "Trojan Source" attack (CVE-2021-42574).',
    severity: 'danger',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'BIDI',
  },
  control: {
    id: 'control',
    label: 'Control character',
    description:
      'A non-printing C0/C1 control code (excluding tab, line feed, and carriage return). Usually signals binary contamination, mojibake, or an attack.',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'CTRL',
  },
  'variation-selector': {
    id: 'variation-selector',
    label: 'Variation selector',
    description:
      'An invisible modifier that selects a glyph variant of the preceding character. Legitimate for emoji and CJK variants, but long runs can smuggle hidden data on a visible carrier.',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'VS',
  },
  tag: {
    id: 'tag',
    label: 'Tag character',
    description:
      'An invisible Plane-14 mirror of ASCII. Outside emoji flag sequences its only real use is "ASCII smuggling" — hiding machine-readable instructions in plain sight.',
    severity: 'danger',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'TAG',
  },
  'private-use': {
    id: 'private-use',
    label: 'Private-use character',
    description:
      'A code point with no standard meaning; how it renders depends entirely on the font (icon fonts, vendor glyphs, or nothing at all).',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'PUA',
  },
  noncharacter: {
    id: 'noncharacter',
    label: 'Noncharacter',
    description:
      'A permanently-reserved code point that is guaranteed never to be a character and is not meant for interchange. Its presence usually means corruption.',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'NCHR',
  },
  blank: {
    id: 'blank',
    label: 'Blank / filler',
    description:
      'A character that occupies space but paints no ink (Hangul fillers, the braille blank). Used to fake spaces or empty-looking names.',
    severity: 'warning',
    group: 'invisible',
    render: 'pill',
    invisible: true,
    abbr: 'BLANK',
  },
  replacement: {
    id: 'replacement',
    label: 'Replacement / object marker',
    description:
      'A visible marker that something went wrong upstream: U+FFFD (�) for an undecodable byte, or U+FFFC where an embedded object used to be.',
    severity: 'notice',
    group: 'invisible',
    render: 'annotate',
    invisible: false,
    abbr: 'REPL',
  },
  'confusable-quote': {
    id: 'confusable-quote',
    label: 'Curly quote / apostrophe',
    description:
      'A curly/smart quote, prime, or apostrophe variant that looks like a straight ASCII quote but is a different character.',
    severity: 'notice',
    group: 'confusable',
    render: 'annotate',
    invisible: false,
    abbr: 'QUOTE',
  },
  'confusable-dash': {
    id: 'confusable-dash',
    label: 'Dash / hyphen variant',
    description:
      'A hyphen, dash, or minus lookalike (en dash, em dash, minus sign, non-breaking hyphen) that resembles an ASCII hyphen but differs in width and meaning.',
    severity: 'notice',
    group: 'confusable',
    render: 'annotate',
    invisible: false,
    abbr: 'DASH',
  },
  'confusable-punctuation': {
    id: 'confusable-punctuation',
    label: 'Confusable punctuation',
    description:
      'Punctuation that imitates a common ASCII mark — the Greek question mark that looks like a semicolon, full-width forms, ellipsis, fraction slash, and similar.',
    severity: 'notice',
    group: 'confusable',
    render: 'annotate',
    invisible: false,
    abbr: 'PUNCT',
  },
  'confusable-letter': {
    id: 'confusable-letter',
    label: 'Homoglyph letter',
    description:
      'A letter from another script (Cyrillic, Greek) or a styled math form that is visually identical to an ASCII letter — the core of homograph spoofing.',
    severity: 'warning',
    group: 'confusable',
    render: 'annotate',
    invisible: false,
    abbr: 'HOMO',
  },
};

export const GROUP_ORDER: CategoryGroup[] = ['invisible', 'whitespace', 'confusable'];

/**
 * Findings that count toward the headline "hidden & unusual" number. Tabs are
 * excluded because a tab is ordinary, expected whitespace — it is revealed and
 * counted, but it is not what the tool is warning you about.
 */
export function countsTowardHeadline(id: CategoryId): boolean {
  return id !== 'tab';
}
