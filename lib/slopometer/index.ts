/** Public API for the Slopometer engine — a deterministic prose-style analyzer. */

export { analyzeText, SHORT_TEXT_WORDS, type AnalyzeOptions } from './analyze';
export { BANDS, scoreToBand } from './score';
export { RULES, SLOP_CATEGORIES, type RuleContext, type RuleDef, type RuleResult } from './rules';
export {
  countWords,
  countCodePoints,
  countLines,
  normalizeForMatch,
  splitLines,
  splitParagraphs,
  splitSentences,
  documentSentences,
  firstWord,
  type Line,
  type Paragraph,
  type Sentence,
} from './text';
export { CLEAN_SAMPLE, SLOP_SAMPLE } from './text-samples';
export type {
  Analysis,
  BandInfo,
  CategoryContribution,
  EvidenceRange,
  Finding,
  SlopCategoryId,
  SlopCategoryMeta,
  TextMetrics,
} from './types';
