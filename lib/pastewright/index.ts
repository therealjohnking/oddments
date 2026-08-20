/**
 * Public API for the Pastewright engine — a local-first instrument that adapts
 * the *representation* of a Markdown document for a chosen destination without
 * ever changing the author's words.
 *
 * The pipeline is inspectable and side-effect-free:
 *   1. parse      — Markdown → a GFM-aware mdast tree (real parser, no regexes)
 *   2. render     — the tree → the destination's representation (+ what changed)
 *   3. report     — the findings → a compact status and a "what changed" list
 *
 * Only plain, serialisable data crosses this boundary — no mdast node and no
 * React type — which is what would let the engine be extracted later and lets
 * every rule be unit-tested without a DOM.
 */

export { transform } from './transform';
export { parseMarkdown, MAX_INPUT_LENGTH } from './parse';

export { DESTINATIONS, destinationMeta, PLAIN_POLICIES, isPlainDestination } from './profiles';
export type { DestinationMeta, PlainPolicy, PlainDestination } from './profiles';

export { buildFindings, statusFromFindings } from './report';
export { EXAMPLES } from './examples';
export type { PastewrightExample } from './examples';

export { displayWidth } from './width';
export {
  extractTable,
  renderAligned,
  renderRecords,
  chooseAutoLayout,
  resolveLayout,
  columnWidths,
  ALIGNED_TARGET_WIDTH,
  MAX_ALIGNED_COLUMNS,
  WRAP_MAX_COLUMNS,
  MIN_COLUMN_WIDTH,
} from './tables';
export type { TableModel, AlignedChoice } from './tables';

export { serializeRich, renderRich } from './rich-text';
export { renderPlain } from './plain-text';
export { renderReddit } from './reddit';
export { sanitizeUrl, escapeHtml, collectDefinitions } from './util';

export {
  STORAGE_KEY,
  STORAGE_VERSION,
  defaultSettings,
  deserializeSettings,
  serializeSettings,
  loadSettings,
  saveSettings,
} from './persistence';
export type { Settings } from './persistence';

export { emptyStats } from './types';
export type {
  Destination,
  TableLayout,
  TableRepresentation,
  Finding,
  FindingCategory,
  FindingImpact,
  TransformStatus,
  TransformStatusKind,
  TransformResult,
  RichNode,
  RichTag,
  RichAttrs,
  RenderStats,
  TableStat,
} from './types';
