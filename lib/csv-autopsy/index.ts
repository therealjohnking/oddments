/**
 * Public API for the CSV Autopsy engine — a local-first CSV profiling and
 * diagnostic instrument.
 *
 * The pipeline is deliberately boring and inspectable:
 *   1. parse      — Papa Parse tokenizes; we detect header / blanks / ragged rows
 *   2. scan       — one pass tallies blank/type/frequency info per column
 *   3. profile    — derive column profiles (types, stats, candidate keys)
 *   4. diagnose   — run every rule against the profiles + structure
 *   5. summarize  — roll up the overview and a bounded preview
 *
 * There is no hidden state, no randomness, and no network — the same input
 * always produces the same analysis, entirely in the browser. Nothing here ever
 * modifies the user's data.
 */

import { toJsonReport, toMarkdownReport } from './export';
import { generateFindings } from './findings';
import { delimiterName, parseCsv } from './parse';
import {
  buildColumnProfile,
  buildOverview,
  buildPreview,
  detectDuplicateRows,
  scanColumns,
} from './profile';
import type { AnalysisMeta, CsvAnalysis, DatasetOverview, ParsedCsv, PreviewData } from './types';

/** Files at or above this size trigger a "may be slow" heads-up in the UI. */
export const LARGE_FILE_BYTES = 5 * 1024 * 1024;

export interface AnalyzeCsvOptions {
  fileName?: string | null;
  fileSize?: number | null;
  /** 'auto' detects a header; 'header'/'no-header' force the interpretation. */
  headerMode?: 'auto' | 'header' | 'no-header';
  maxRows?: number;
}

function emptyOverview(meta: AnalysisMeta): DatasetOverview {
  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    rows: 0,
    columns: 0,
    delimiter: '',
    delimiterName: 'none',
    lineBreak: 'none',
    headerDetected: false,
    headerAssumed: false,
    hasHeader: false,
    bom: false,
    blankRows: 0,
    duplicateRows: 0,
    duplicateGroups: 0,
    totalCells: 0,
    populatedCells: 0,
    blankCells: 0,
    completeness: 0,
    findingCount: 0,
    findingCountBySeverity: { info: 0, notice: 0, warning: 0 },
    truncated: false,
    analyzedRows: 0,
  };
}

function emptyPreview(): PreviewData {
  return {
    header: [],
    rows: [],
    rowNumbers: [],
    shownRows: 0,
    totalRows: 0,
    truncatedRows: false,
    shownColumns: 0,
    totalColumns: 0,
    truncatedColumns: false,
    malformedRows: new Set(),
    blankRows: new Set(),
  };
}

function emptyParsed(): ParsedCsv {
  return {
    header: [],
    rawFirstRow: [],
    rows: [],
    hasHeader: false,
    headerDetected: false,
    headerAssumed: false,
    delimiter: '',
    lineBreak: '',
    lineBreakStyle: 'none',
    bom: false,
    columnCount: 0,
    rowShapeIssues: [],
    parseIssues: [],
    blankRowIndexes: [],
    truncated: false,
    analyzedRows: 0,
    totalRows: 0,
  };
}

function shell(
  meta: AnalysisMeta,
  isEmpty: boolean,
  hadError: boolean,
  errorMessage?: string,
): CsvAnalysis {
  return {
    isEmpty,
    hadError,
    errorMessage,
    overview: emptyOverview(meta),
    columns: [],
    findings: [],
    preview: emptyPreview(),
    parse: emptyParsed(),
    meta,
  };
}

/** Analyze raw CSV text into a full, deterministic diagnostic Analysis. */
export function analyzeCsv(input: string, options: AnalyzeCsvOptions = {}): CsvAnalysis {
  const fileName = options.fileName ?? null;
  const fileSize = options.fileSize ?? null;
  const large = fileSize !== null ? fileSize > LARGE_FILE_BYTES : input.length > LARGE_FILE_BYTES;
  const meta: AnalysisMeta = { fileName, fileSize, large };

  if (input.length === 0) return shell(meta, true, false);

  let parsed: ParsedCsv;
  try {
    parsed = parseCsv(input, { headerMode: options.headerMode, maxRows: options.maxRows });
  } catch (error) {
    return shell(
      meta,
      false,
      true,
      error instanceof Error ? error.message : 'Failed to parse the file.',
    );
  }

  if (parsed.columnCount === 0) return shell(meta, true, false);

  const scans = scanColumns(parsed);
  const columns = scans.map((scan) => buildColumnProfile(scan, parsed));
  const duplicates = detectDuplicateRows(parsed);
  const findings = generateFindings({ parsed, scans, columns, duplicates });
  const overview = buildOverview(parsed, columns, duplicates, findings, {
    fileName,
    fileSize,
    delimiterName: delimiterName(parsed.delimiter),
  });
  const preview = buildPreview(parsed);

  return {
    isEmpty: false,
    hadError: false,
    overview,
    columns,
    findings,
    preview,
    parse: parsed,
    meta,
  };
}

export { parseCsv, delimiterName, detectLineBreakStyle, DEFAULT_MAX_ROWS } from './parse';
export {
  classifyCell,
  classifyValue,
  parseNumericLike,
  parseDateLike,
  resolveDominantType,
  isBooleanColumnShape,
  NULL_LIKE_TOKENS,
  TYPE_DOMINANCE,
  TEXT_DOMINANCE,
} from './infer';
export { computeNumericStats, computeDateStats } from './stats';
export {
  scanColumns,
  buildColumnProfile,
  detectDuplicateRows,
  buildOverview,
  buildPreview,
  looksLikeIdName,
  CATEGORICAL_MAX,
  MIN_KEY_ROWS,
  PREVIEW_ROWS,
  PREVIEW_COLS,
  type ColumnScan,
  type DuplicateRowInfo,
} from './profile';
export { generateFindings } from './findings';
export { SEVERITY_RANK } from './types';
export { toMarkdownReport, toJsonReport } from './export';
export { formatNumber, formatPercent, formatBytes } from './format';
export { SAMPLE_CSV, SAMPLE_FILENAME } from './sample-data';
export type {
  CsvAnalysis,
  DatasetOverview,
  ColumnProfile,
  ColumnType,
  ValueType,
  CellClass,
  CsvFinding,
  FindingCategory,
  FindingSeverity,
  FindingExample,
  NumericStats,
  DateStats,
  ValueCount,
  DuplicateRowGroup,
  CandidateKeyConfidence,
  TypeBreakdown,
  PreviewData,
  ParsedCsv,
  LineBreakStyle,
  RowShapeIssue,
  ParseIssue,
  AnalysisMeta,
} from './types';
