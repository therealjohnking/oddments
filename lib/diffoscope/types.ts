/**
 * Shared types for Diffoscope — a human-oriented text comparison instrument.
 *
 * Diffoscope compares two pieces of text (A / Before and B / After) and explains
 * exactly what changed, *including the differences a human eye slides past*:
 * whitespace, line endings, invisible formatting characters, typographic
 * punctuation, and Unicode-normalization variants.
 *
 * Everything here is deterministic and runs entirely in the browser. Offsets are
 * UTF-16 indexes into the original, unmodified inputs; comparison "lenses" change
 * how the inputs are *matched*, never the inputs themselves.
 */

/** The unit a comparison is expressed in. */
export type DiffMode = 'word' | 'char' | 'line';

/** A single elementary edit operation in the diff stream. */
export type DiffOp = 'equal' | 'insert' | 'delete';

/** How the line was terminated in the source (kept for diagnostics). */
export type LineTerminator = 'lf' | 'crlf' | 'cr' | 'none';

/**
 * A comparison lens reinterprets how A and B are *matched* without altering
 * either source. The displayed text is always the original; only equality of
 * tokens is affected. A few coherent, composable options — not a matrix.
 */
export interface LensState {
  /** Match letters case-insensitively. */
  ignoreCase: boolean;
  /** Treat differing whitespace (amount, kind, line-ending style) as equal. */
  ignoreWhitespace: boolean;
  /** Compare Unicode canonical (NFC) forms, so precomposed == decomposed. */
  nfc: boolean;
}

export const EXACT_LENS: LensState = {
  ignoreCase: false,
  ignoreWhitespace: false,
  nfc: false,
};

/** The class of a token, used for whitespace handling and rendering. */
export type TokenKind = 'word' | 'space' | 'punct' | 'grapheme' | 'line';

/** A comparison token: an exact source substring plus where it came from. */
export interface Token {
  /**
   * The exact source substring. Concatenating a grapheme/word stream reproduces
   * the input; for line tokens the terminator is held separately (see
   * `terminator`), so `value` is the line content without its LF/CRLF/CR.
   */
  value: string;
  /** UTF-16 offset of `value` within its source string. */
  start: number;
  kind: TokenKind;
  /** Line tokens only: the terminator that followed this line's content. */
  terminator?: LineTerminator;
}

/**
 * One renderable run of the inline diff. For `equal`/`delete` the text and
 * offsets come from A; for `insert`, from B. In line mode each segment is a
 * single line (never coalesced) so it can carry a line number; in word/char
 * mode adjacent same-op tokens are coalesced into one segment.
 */
export interface DiffSegment {
  op: DiffOp;
  /** Display text (equal/delete → A's text, insert → B's text). */
  value: string;
  /** UTF-16 offset in A (present for equal/delete). */
  aStart?: number;
  /** UTF-16 offset in B (present for equal/insert). */
  bStart?: number;
  /** 1-based line number in A (line mode; equal/delete). */
  aLine?: number;
  /** 1-based line number in B (line mode; equal/insert). */
  bLine?: number;
  /**
   * Line mode: this line's own terminator style (A's for equal/delete, B's for
   * insert). Kept for optional CRLF/CR/LF marking — not for byte-faithful
   * reconstruction, since line content is compared terminator-agnostically.
   */
  terminator?: LineTerminator;
}

/** The result of comparing A and B in one mode under one lens. */
export interface ModeDiff {
  mode: DiffMode;
  lens: LensState;
  /** The inline diff stream (may be render-capped; see `renderCapped`). */
  segments: DiffSegment[];
  /** Human label for the comparison unit ("word" / "character" / "line"). */
  unit: string;
  /** Count of inserted tokens (exact, computed before any render cap). */
  inserted: number;
  /** Count of deleted tokens (exact). */
  deleted: number;
  /** Maximal runs of non-equal segments — "places where it changed". */
  changedRegions: number;
  /** Line mode only: number of A/B lines that are inserted, deleted, or changed. */
  changedLines?: number;
  /** True when nothing differs under this lens. */
  equal: boolean;
  /** True when the rendered segment list was capped for a very large input. */
  renderCapped: boolean;
  /** True when the diff degraded to a non-minimal block replace (pathological input). */
  degraded: boolean;
  /**
   * Char mode only: true when character comparison was skipped because the input
   * is too large to compare grapheme-by-grapheme without an explicit request.
   */
  charDisabled: boolean;
}

/** Per-line-ending tally for one input. */
export interface LineEndingCounts {
  lf: number;
  cr: number;
  crlf: number;
  /** Total terminators (excludes the implicit final segment). */
  total: number;
  mixed: boolean;
  dominant: Exclude<LineTerminator, 'none'> | null;
  /** True when the text has content but no trailing newline. */
  finalNewline: boolean;
}

/** Summary statistics for one side (A or B). */
export interface SideStats {
  isEmpty: boolean;
  /** Unicode code points. */
  chars: number;
  /** User-perceived characters (grapheme clusters) when supported. */
  graphemes: number;
  words: number;
  lines: number;
  /** UTF-8 byte length. */
  bytes: number;
  lineEndings: LineEndingCounts;
}

/** The dimensions along which two "identical-looking" texts can cosmetically differ. */
export type CosmeticDim =
  'line-endings' | 'whitespace' | 'case' | 'nfc' | 'punctuation' | 'homoglyph' | 'invisibles';

export type VerdictKind =
  | 'identical'
  | 'empty-vs-nonempty'
  | 'line-endings'
  | 'whitespace'
  | 'case'
  | 'nfc'
  | 'punctuation'
  | 'homoglyph'
  | 'invisibles'
  | 'cosmetic'
  | 'different';

/** The single most informative statement about how A and B relate. */
export interface Verdict {
  kind: VerdictKind;
  /** Short chip label, e.g. "Line endings only". */
  label: string;
  /** One-sentence plain-language explanation. */
  headline: string;
  /** For `cosmetic`: the specific dimensions that, combined, explain the difference. */
  dimensions: CosmeticDim[];
}

/** The family of a subtle, position-level difference. */
export type SubtleKind =
  | 'line-ending'
  | 'whitespace'
  | 'invisible'
  | 'punctuation'
  | 'homoglyph'
  | 'case'
  | 'normalization';

export type SubtleSeverity = 'info' | 'notice' | 'warning';

/** A single located subtle difference (one A↔B correspondence). */
export interface SubtlePosition {
  aText?: string;
  aCodePoint?: number;
  aName?: string;
  aLine?: number;
  aColumn?: number;
  bText?: string;
  bCodePoint?: number;
  bName?: string;
  bLine?: number;
  bColumn?: number;
  /** Optional supporting note. */
  note?: string;
}

/** A grouped subtle-difference finding (e.g. all curly-vs-straight apostrophes). */
export interface SubtleFinding {
  id: string;
  kind: SubtleKind;
  severity: SubtleSeverity;
  /** Short title, e.g. "Non-breaking space vs ordinary space". */
  title: string;
  /** Plain-language description, already interpolated with counts. */
  detail: string;
  /** One sentence on why it can matter. */
  why: string;
  /** Number of occurrences (exact; may exceed the stored example count). */
  count: number;
  /** Representative located occurrences (capped). */
  examples: SubtlePosition[];
  examplesTruncated: boolean;
}

export const SUBTLE_SEVERITY_RANK: Record<SubtleSeverity, number> = {
  warning: 2,
  notice: 1,
  info: 0,
};

/**
 * The lens/mode-independent analysis of the *raw* pair: are they equal, the
 * per-side statistics, the overall verdict, and the located subtle differences.
 */
export interface PairAnalysis {
  bothEmpty: boolean;
  exactlyEqual: boolean;
  a: SideStats;
  b: SideStats;
  verdict: Verdict;
  findings: SubtleFinding[];
  findingsCapped: boolean;
  /** True when the grapheme-level subtle scan was skipped (input too large). */
  charComparisonSkipped: boolean;
}
