/**
 * Shared types for Slopometer — the deterministic prose-style analyzer.
 *
 * Slopometer detects *writing crimes, not authorship*. Nothing here (or anywhere
 * in the engine) attempts to decide whether text was produced by a person or a
 * machine; that is unreliable and explicitly out of scope. Every number the
 * engine produces is a transparent, rule-derived heuristic.
 */

/** The eight human-facing detection categories. */
export type SlopCategoryId =
  | 'rhetorical-setup'
  | 'audience-instruction'
  | 'contrast-template'
  | 'corporate-jargon'
  | 'content-cliche'
  | 'structure'
  | 'punctuation'
  | 'repetition';

export interface SlopCategoryMeta {
  id: SlopCategoryId;
  label: string;
  /** One-line, plain-language description of what this category catches. */
  blurb: string;
}

/**
 * A concrete piece of text a finding is reacting to. Offsets are UTF-16 indices
 * into the *original, unmodified* input so the UI can highlight them exactly.
 */
export interface EvidenceRange {
  /** Stable id, unique within one analysis (`ruleId` + start offset). */
  id: string;
  /** UTF-16 start offset (inclusive) in the original input. */
  start: number;
  /** UTF-16 end offset (exclusive) in the original input. */
  end: number;
  /** The matched substring, exactly as it appears in the input. */
  excerpt: string;
  /** Optional short label (e.g. the canonical phrase, or "rhetorical question"). */
  note?: string;
}

export interface Finding {
  ruleId: string;
  category: SlopCategoryId;
  /** Short, human title for the rule (e.g. "Em-dash enthusiasm"). */
  title: string;
  /** Plain-language explanation, already interpolated with the measured counts. */
  explanation: string;
  /** Occurrence count or measured magnitude the explanation refers to. */
  occurrences: number;
  /** Points this rule contributed to the score (rounded, after its own cap). */
  contribution: number;
  /** True when the rule reached its individual maximum contribution. */
  atCap: boolean;
  /** Text ranges backing this finding; empty for purely statistical rules. */
  evidence: EvidenceRange[];
  /** For statistical rules: a short measured-condition summary. */
  detail?: string;
  /** True when the stored evidence list was truncated for a very large input. */
  evidenceTruncated: boolean;
}

export interface BandInfo {
  id: 'human' | 'linkedin' | 'content' | 'thought-leadership';
  label: string;
  /** Inclusive lower score bound. */
  min: number;
  /** Inclusive upper score bound. */
  max: number;
  /** One-line interpretation, in the Oddments voice. */
  blurb: string;
}

export interface TextMetrics {
  /** Unicode code points (astral-safe). */
  characters: number;
  /** Word-like tokens. */
  words: number;
  /** Sentence units (pragmatic split; not a parser). */
  sentences: number;
  /** Blank-line-separated blocks. */
  paragraphs: number;
  /** Lines (any platform's line break counts as one). */
  lines: number;
}

export interface CategoryContribution {
  category: SlopCategoryId;
  label: string;
  /** Sum of the contributions of this category's findings. */
  contribution: number;
  findingCount: number;
}

export interface Analysis {
  /** True when there is nothing to analyze (empty or whitespace-only input). */
  isEmpty: boolean;
  /** True when the sample is too short for meaningful structural analysis. */
  tooShort: boolean;
  /** Final Slopometer score, 0–100. */
  score: number;
  /** Sum of every finding's contribution before the 100 cap. */
  rawScore: number;
  /** True when `rawScore` exceeded 100 and was clamped. */
  scoreCapped: boolean;
  band: BandInfo;
  metrics: TextMetrics;
  /** All findings that fired, sorted by contribution (desc), then title. */
  findings: Finding[];
  /** Per-category contribution totals, sorted by contribution (desc). */
  categoryContributions: CategoryContribution[];
}
