/**
 * Public API for the JSON Crime Scene engine — a local-first instrument for
 * inspecting, understanding, and diagnosing one JSON document.
 *
 * The pipeline is deliberately boring and inspectable:
 *   1. parse      — jsonc builds a source-faithful tree; JSON.parse decides validity
 *   2. traverse   — one iterative pass → domain tree + stats + duplicate keys
 *   3. shapes     — profile every array-of-objects by normalized key set
 *   4. diagnose   — run every observational rule
 *   5. profile    — roll up the structural overview
 *
 * There is no hidden state, no randomness, and no network: the same input always
 * produces the same analysis, entirely in the browser. Nothing here modifies the
 * user's JSON.
 */

import { diagnose } from './diagnostics';
import { parseDocument } from './parse';
import { analyzeShapes } from './shapes';
import { traverse } from './traverse';
import type {
  AnalysisMeta,
  FindingSeverity,
  JsonAnalysis,
  JsonFinding,
  StructuralProfile,
} from './types';
import { utf8ByteLength } from './traverse';

/** Documents at or above this size trigger a "may be slow" heads-up in the UI. */
export const LARGE_BYTES = 2 * 1024 * 1024;

export interface AnalyzeJsonOptions {
  fileName?: string | null;
  fileSize?: number | null;
}

function countBySeverity(findings: JsonFinding[]): Record<FindingSeverity, number> {
  const counts: Record<FindingSeverity, number> = { info: 0, notice: 0, warning: 0 };
  for (const finding of findings) counts[finding.severity]++;
  return counts;
}

/** Analyze raw JSON text into a full, deterministic analysis. */
export function analyzeJson(input: string, options: AnalyzeJsonOptions = {}): JsonAnalysis {
  const fileName = options.fileName ?? null;
  const fileSize = options.fileSize ?? null;
  const bytes = fileSize ?? utf8ByteLength(input);
  const meta: AnalysisMeta = { fileName, fileSize, large: bytes >= LARGE_BYTES };

  if (input.trim() === '') return { status: 'empty', meta };

  try {
    const outcome = parseDocument(input);

    if (outcome.kind === 'too-complex') {
      return { status: 'too-complex', reason: outcome.reason, source: input, meta };
    }
    if (outcome.kind === 'invalid') {
      return { status: 'error', error: outcome.error, source: input, meta };
    }

    const { tree, stats, duplicateGroups } = traverse(outcome.tree, input);
    const shapes = analyzeShapes(tree);
    const findings = diagnose({
      tree,
      source: input,
      stats,
      duplicateGroups,
      shapes,
      lineIndex: outcome.lineIndex,
    });
    const profile: StructuralProfile = {
      ...stats,
      findingCount: findings.length,
      findingCountBySeverity: countBySeverity(findings),
    };

    return {
      status: 'ok',
      source: input,
      meta,
      tree,
      profile,
      findings,
      shapes,
      hasDuplicateKeys: stats.duplicateKeyGroups > 0,
    };
  } catch {
    // Any unexpected engine failure degrades to an honest notice rather than a
    // broken page. (The iterative passes make this path very unlikely.)
    return { status: 'too-complex', reason: 'engine', source: input, meta };
  }
}

export { parseDocument, LineIndex } from './parse';
export { traverse, previewString, utf8ByteLength, PREVIEW_CAP } from './traverse';
export { analyzeShapes, MIN_OBJECTS_FOR_SHAPE } from './shapes';
export { diagnose } from './diagnostics';
export { inspectNumberLiteral, SAFE_MIN, SAFE_MAX } from './numbers';
export { searchTree, SEARCH_LIMIT } from './search';
export { toPretty, toMinified, toSortedKeys, canSortKeys } from './transform';
export { toMarkdownReport, toJsonReport } from './report';
export { formatInt, formatPercent, formatBytes } from './format';
export {
  toJsonPointer,
  fromJsonPointer,
  toJsPath,
  encodePointerToken,
  decodePointerToken,
} from './paths';
export { SAMPLE_JSON, SAMPLE_FILENAME } from './sample-data';
export { SEVERITY_RANK } from './types';
export type {
  JsonAnalysis,
  JsonKind,
  JsonNode,
  JsonFinding,
  JsonFindingExample,
  FindingSeverity,
  FindingCategory,
  StructureStats,
  StructuralProfile,
  Hotspot,
  SourcePosition,
  JsonParseError,
  AnalysisMeta,
  SearchHit,
  SearchResult,
  ArrayShapeReport,
  ShapeVariant,
  FieldTypeVariance,
  FieldNullability,
} from './types';
