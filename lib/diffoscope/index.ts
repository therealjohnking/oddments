/**
 * Public API for the Diffoscope engine — a human-oriented text comparison
 * instrument.
 *
 * The pipeline is deliberately inspectable and has no hidden state, no
 * randomness, and no network:
 *   1. tokenize    — Unicode-correct units (graphemes / words / lines)
 *   2. lens        — reinterpret matching without touching the sources
 *   3. diff (Myers)— the standard shortest-edit-script over token keys
 *   4. segments    — wrap the ops into renderable inline segments + counts
 *   5. diagnose    — the verdict + located "these look identical" findings
 *
 * `analyzePair` is lens/mode-independent (the raw relationship of A and B);
 * `diffInMode` produces one mode's diff under one lens. The React UI memoizes
 * each separately, so switching modes never recomputes the diagnostics.
 * Nothing here ever modifies either input.
 */

import { computeVerdict, extractSubtleFindings } from './diagnostics';
import { computeSideStats } from './stats';
import type { PairAnalysis } from './types';

/** Analyze the raw pair: equality, per-side stats, verdict, and subtle findings. */
export function analyzePair(a: string, b: string): PairAnalysis {
  const verdict = computeVerdict(a, b);
  const subtle = extractSubtleFindings(a, b, verdict.kind);
  return {
    bothEmpty: a === '' && b === '',
    exactlyEqual: a === b,
    a: computeSideStats(a),
    b: computeSideStats(b),
    verdict,
    findings: subtle.findings,
    findingsCapped: subtle.capped,
    charComparisonSkipped: subtle.skipped,
  };
}

export { diffInMode, type DiffOptions } from './compare';
export { computeVerdict, extractSubtleFindings, describeCodePoint } from './diagnostics';
export { toSummaryReport } from './export';
export { toUnifiedDiff } from './unified-diff';
export { computeSideStats, computeLineEndings, countLines } from './stats';
export { diffKeys, lcsLength, type EditScript } from './myers';
export { tokenize, tokenizeWords, tokenizeLines, tokenizeGraphemes } from './tokenize';
export {
  lensKey,
  lensKeys,
  collapseWhitespace,
  foldConfusables,
  stripInvisibles,
} from './normalize';
export { LineIndex } from './positions';
export { EXAMPLES, FLAGSHIP_EXAMPLE, type DiffExample } from './samples';
export { EXACT_LENS } from './types';
export type {
  DiffMode,
  DiffOp,
  DiffSegment,
  LensState,
  LineEndingCounts,
  ModeDiff,
  PairAnalysis,
  SideStats,
  SubtleFinding,
  SubtleKind,
  SubtlePosition,
  SubtleSeverity,
  Verdict,
  VerdictKind,
  CosmeticDim,
  Token,
  TokenKind,
  LineTerminator,
} from './types';
