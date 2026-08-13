/** Public API for the Invisible Character Inspector engine. */

export { analyzeText, type AnalyzeOptions } from './analyze';
export { classify, type Classification } from './classify';
export {
  CATEGORY_IDS,
  CATEGORY_META,
  GROUP_LABELS,
  GROUP_ORDER,
  SEVERITY_RANK,
  countsTowardHeadline,
  type CategoryGroup,
  type CategoryId,
  type CategoryMeta,
  type RenderStyle,
  type Severity,
} from './categories';
export {
  PIPELINE_ORDER,
  TRANSFORMS,
  TRANSFORM_LIST,
  applyTransforms,
  defaultEnabledTransforms,
  type CleanResult,
  type TransformDef,
  type TransformId,
  type TransformRisk,
} from './clean';
export {
  countCodePoints,
  countGraphemes,
  fallbackAbbr,
  formatCodePoint,
  utf8ByteLength,
} from './format';
export { EXAMPLE_TEXT } from './text-samples';
export type {
  Analysis,
  CategorySummary,
  Finding,
  LineEndingSummary,
  LineInfo,
  LineTerminator,
  Stats,
  TrailingWhitespace,
} from './types';
