/**
 * Column scanning and dataset profiling for CSV Autopsy.
 *
 * The expensive work happens once, in `scanColumns`: a single pass over every
 * cell that tallies blank/type/frequency information column by column. Everything
 * downstream (public column profiles, the dataset overview, duplicate detection,
 * and the diagnostic rules) reads those scans instead of re-walking the data, so
 * analysis stays close to O(cells) regardless of how many findings fire.
 *
 * Memory is kept in check with explicit caps: frequency maps stop growing past a
 * ceiling (marking the distinct count inexact), categorical-only work is gated on
 * cardinality, and per-column statistics are computed in transient passes rather
 * than by retaining a second copy of the data.
 */

import { formatNumber } from './format';
import { classifyCell, isBlankClass, isBooleanColumnShape, resolveDominantType } from './infer';
import { computeDateStats, computeNumericStats } from './stats';
import type {
  ColumnProfile,
  ColumnType,
  DatasetOverview,
  DuplicateRowGroup,
  FindingSeverity,
  ParsedCsv,
  PreviewData,
  TypeBreakdown,
  ValueCount,
  ValueType,
  CsvFinding,
} from './types';

/** Distinct values tracked per column before the count is marked inexact. */
export const DISTINCT_CAP = 200_000;
/** At or below this cardinality a column is treated as categorical. */
export const CATEGORICAL_MAX = 200;
/** Top values retained for display / near-constant detection. */
const TOP_VALUES = 12;
/** Example populated values retained per column. */
const SAMPLE_VALUES = 5;
/** Mean value length above which a unique text column is deemed free text, not an id. */
const FREE_TEXT_MEAN_LEN = 40;
/** Minimum populated rows before a candidate-key claim is credible. */
export const MIN_KEY_ROWS = 8;

/** Internal per-column scan result — richer than the public profile, used by findings. */
export interface ColumnScan {
  index: number;
  name: string;
  synthesizedName: boolean;
  total: number;
  populated: number;
  empty: number;
  whitespace: number;
  nullLike: number;
  /** Distinct null-like tokens actually seen (e.g. "N/A", "NULL"), capped. */
  nullLikeTokens: Set<string>;
  breakdown: TypeBreakdown;
  /** Trimmed populated value → count. */
  freq: Map<string, number>;
  distinctExact: boolean;
  /** Populated cells whose raw form has leading/trailing whitespace. */
  paddedCount: number;
  /** A few examples of padded raw values, with 1-based row numbers. */
  paddedExamples: { value: string; row: number }[];
  /** For categorical columns: trimmed value → { clean, padded } tallies. */
  wsSplit: Map<string, { clean: number; padded: number }> | null;
  /** Rows (1-based) of whitespace-only cells, capped. */
  whitespaceRows: number[];
  sampleValues: string[];
  /** Sum of trimmed lengths of populated values (for mean length). */
  lengthSum: number;
}

function emptyBreakdown(): TypeBreakdown {
  return { integer: 0, decimal: 0, boolean: 0, date: 0, datetime: 0, text: 0 };
}

function familyOf(type: ValueType): 'numeric' | 'temporal' | 'boolean' | 'text' {
  if (type === 'integer' || type === 'decimal') return 'numeric';
  if (type === 'date' || type === 'datetime') return 'temporal';
  if (type === 'boolean') return 'boolean';
  return 'text';
}

function familyOfColumn(type: ColumnType): 'numeric' | 'temporal' | 'boolean' | 'text' | null {
  if (type === 'integer' || type === 'decimal') return 'numeric';
  if (type === 'date' || type === 'datetime') return 'temporal';
  if (type === 'boolean') return 'boolean';
  return null;
}

/** Walk every cell once, producing a scan per column. */
export function scanColumns(parsed: ParsedCsv): ColumnScan[] {
  const { rows, columnCount, header } = parsed;
  const total = rows.length;

  const scans: ColumnScan[] = [];
  for (let j = 0; j < columnCount; j++) {
    const rawName = header[j] ?? `Column ${j + 1}`;
    const synthesizedName = !parsed.hasHeader || rawName.trim().length === 0;
    scans.push({
      index: j,
      name: rawName.trim().length === 0 ? `Column ${j + 1}` : rawName,
      synthesizedName,
      total,
      populated: 0,
      empty: 0,
      whitespace: 0,
      nullLike: 0,
      nullLikeTokens: new Set(),
      breakdown: emptyBreakdown(),
      freq: new Map(),
      distinctExact: true,
      paddedCount: 0,
      paddedExamples: [],
      wsSplit: new Map(),
      whitespaceRows: [],
      sampleValues: [],
      lengthSum: 0,
    });
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + 1;
    for (let j = 0; j < columnCount; j++) {
      const scan = scans[j]!;
      const raw = row[j] ?? '';
      const cls = classifyCell(raw);

      if (cls === 'empty') {
        scan.empty++;
        continue;
      }
      if (cls === 'whitespace') {
        scan.whitespace++;
        if (scan.whitespaceRows.length < 50) scan.whitespaceRows.push(rowNumber);
        continue;
      }
      if (cls === 'null-like') {
        scan.nullLike++;
        if (scan.nullLikeTokens.size < 8) scan.nullLikeTokens.add(raw.trim());
        continue;
      }

      // Populated value.
      const trimmed = raw.trim();
      scan.populated++;
      scan.lengthSum += trimmed.length;
      scan.breakdown[cls]++;

      if (scan.sampleValues.length < SAMPLE_VALUES) scan.sampleValues.push(raw);

      // Distinctness is keyed on the EXACT value: two strings that differ in any
      // way — "St. Louis" vs "St Louis", "Ohio" vs "Ohio " — are genuinely
      // distinct values. The consistency and whitespace findings below are the
      // advisory layer that flags which distinct values may be the same thing.
      const existing = scan.freq.get(raw);
      if (existing !== undefined) {
        scan.freq.set(raw, existing + 1);
      } else if (scan.freq.size < DISTINCT_CAP) {
        scan.freq.set(raw, 1);
      } else {
        scan.distinctExact = false;
      }

      const padded = raw !== trimmed;
      if (padded) {
        scan.paddedCount++;
        if (scan.paddedExamples.length < 25) {
          scan.paddedExamples.push({ value: raw, row: rowNumber });
        }
      }

      // Whitespace-variant clustering is only meaningful for categorical columns.
      if (scan.wsSplit) {
        if (scan.freq.size <= CATEGORICAL_MAX + 1) {
          const bucket = scan.wsSplit.get(trimmed) ?? { clean: 0, padded: 0 };
          if (padded) bucket.padded++;
          else bucket.clean++;
          scan.wsSplit.set(trimmed, bucket);
        } else {
          scan.wsSplit = null; // high cardinality: stop tracking
        }
      }
    }
  }

  return scans;
}

function distinctLowerSet(freq: Map<string, number>): Set<string> {
  const set = new Set<string>();
  for (const key of freq.keys()) set.add(key.toLowerCase());
  return set;
}

function topValues(freq: Map<string, number>, limit: number): ValueCount[] {
  const entries: ValueCount[] = [];
  for (const [value, count] of freq) entries.push({ value, count });
  entries.sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  return entries.slice(0, limit);
}

const ID_NAME_RE =
  /(^|[\s_\-.])(id|ids|key|keys|code|codes|number|no|num|uuid|guid|ref|sku|isbn|ssn|account|acct)([\s_\-.]|$)/i;

// A stricter set: names that genuinely imply *uniqueness*. `code`, `number`,
// `no`, `ref`, `account` are excluded because they are just as often ordinary
// categories (postal_code, phone_number, area_code) that legitimately repeat.
const STRONG_ID_NAME_RE = /(^|[\s_\-.])(id|ids|key|keys|uuid|guid|ssn|sku|isbn)([\s_\-.]|$)/i;

export function looksLikeIdName(name: string): boolean {
  return ID_NAME_RE.test(name.trim());
}

/** A name that strongly implies the column should be unique (id, key, uuid, …). */
export function looksLikeStrongIdName(name: string): boolean {
  return STRONG_ID_NAME_RE.test(name.trim());
}

/** Build the public profile for a column from its scan. */
export function buildColumnProfile(scan: ColumnScan, parsed: ParsedCsv): ColumnProfile {
  const { populated, total } = scan;
  const blank = scan.empty + scan.whitespace + scan.nullLike;
  const distinct = scan.freq.size;
  const distinctLower = distinctLowerSet(scan.freq);
  const booleanShape = populated > 0 && scan.distinctExact && isBooleanColumnShape(distinctLower);

  const dominantResult = resolveDominantType(scan.breakdown, populated, booleanShape);
  const dominantType = dominantResult.type;
  const meanLength = populated > 0 ? scan.lengthSum / populated : 0;

  const uniqueness = populated > 0 ? distinct / populated : 0;
  const completeness = total > 0 ? populated / total : 0;
  const isConstant = populated > 0 && distinct === 1;
  const categorical = scan.distinctExact && distinct <= CATEGORICAL_MAX;

  // Stats + anomalies via a targeted pass, only where it makes sense.
  let numeric: ColumnProfile['numeric'];
  let dates: ColumnProfile['dates'];
  let anomalyCount = 0;
  let anomalyExamples: ColumnProfile['anomalyExamples'] = [];

  const family = familyOfColumn(dominantType);
  if (family) {
    // A boolean-shaped column (≤2 tokens all drawn from the boolean vocabulary) is
    // all-conforming by construction — the per-value classifier just doesn't label
    // 0/1 or y/n as "boolean", so we must not count those as anomalies. Stats run
    // over EVERY populated cell (not the conforming subset) so a date parse-rate
    // can legitimately read below 100% when some values are not dates.
    const countAnomalies = !(family === 'boolean' && booleanShape);
    const allPopulated: string[] = [];
    const anomalies: ColumnProfile['anomalyExamples'] = [];
    for (let i = 0; i < parsed.rows.length; i++) {
      const raw = parsed.rows[i]![scan.index] ?? '';
      const cls = classifyCell(raw);
      if (isBlankClass(cls)) continue;
      allPopulated.push(raw);
      if (countAnomalies && familyOf(cls as ValueType) !== family) {
        anomalyCount++;
        if (anomalies.length < 12)
          anomalies.push({ value: raw, row: i + 1, note: `read as ${cls}` });
      }
    }
    anomalyExamples = anomalies;
    if (family === 'numeric') numeric = computeNumericStats(allPopulated) ?? undefined;
    if (family === 'temporal') dates = computeDateStats(allPopulated) ?? undefined;
  }

  const { candidateKey, candidateKeyReason } = assessCandidateKey({
    name: scan.name,
    dominantType,
    completeness,
    uniqueness,
    populated,
    meanLength,
    synthesizedName: scan.synthesizedName,
  });

  return {
    index: scan.index,
    name: scan.name,
    synthesizedName: scan.synthesizedName,
    dominantType,
    typeConformity: dominantResult.conformity,
    typeBreakdown: scan.breakdown,
    total,
    populated,
    empty: scan.empty,
    whitespace: scan.whitespace,
    nullLike: scan.nullLike,
    blank,
    completeness,
    distinct,
    distinctExact: scan.distinctExact,
    uniqueness,
    isConstant,
    topValues: categorical || distinct <= TOP_VALUES ? topValues(scan.freq, TOP_VALUES) : [],
    categorical,
    sampleValues: scan.sampleValues.slice(),
    numeric,
    dates,
    candidateKey,
    candidateKeyReason,
    anomalyCount,
    anomalyExamples,
    meanLength,
    findingIds: [],
  };
}

interface CandidateKeyInput {
  name: string;
  dominantType: ColumnType;
  completeness: number;
  uniqueness: number;
  populated: number;
  meanLength: number;
  synthesizedName: boolean;
}

function assessCandidateKey(input: CandidateKeyInput): {
  candidateKey: ColumnProfile['candidateKey'];
  candidateKeyReason?: string;
} {
  const { completeness, uniqueness, populated, dominantType, meanLength } = input;
  if (populated < MIN_KEY_ROWS) return { candidateKey: 'none' };
  if (completeness < 0.98 || uniqueness < 0.98) return { candidateKey: 'none' };

  // High-cardinality free text is technically unique but is not an identifier.
  const freeText = dominantType === 'text' && meanLength > FREE_TEXT_MEAN_LEN;
  if (freeText) return { candidateKey: 'none' };

  const nameHint = looksLikeIdName(input.name) && !input.synthesizedName;
  const stableLooking =
    dominantType === 'integer' || dominantType === 'boolean' ? false : meanLength <= 24;

  if (completeness === 1 && uniqueness === 1) {
    if (nameHint) {
      return {
        candidateKey: 'strong',
        candidateKeyReason: 'Fully populated, fully unique, and named like an identifier.',
      };
    }
    if (dominantType === 'integer' || stableLooking) {
      return {
        candidateKey: 'possible',
        candidateKeyReason: 'Fully populated and fully unique — a plausible record identifier.',
      };
    }
    return {
      candidateKey: 'possible',
      candidateKeyReason: 'Fully populated and fully unique, though the values look free-form.',
    };
  }

  return {
    candidateKey: 'possible',
    candidateKeyReason: 'Nearly fully populated and nearly unique.',
  };
}

export interface DuplicateRowInfo {
  duplicateRows: number;
  duplicateGroups: number;
  groups: DuplicateRowGroup[];
}

const DUP_GROUP_CAP = 25;
const DUP_ROW_EXAMPLES = 5;

/** Detect exact-duplicate data rows (blank rows are excluded — they are their own finding). */
export function detectDuplicateRows(parsed: ParsedCsv): DuplicateRowInfo {
  // Rows are keyed by joining fields on U+0001 — a control char that cannot
  // appear unescaped in a parsed field — so rows with different field
  // boundaries (["1","23"] vs ["12","3"]) never collapse into the same key.
  const seen = new Map<string, { rows: number[]; count: number }>();
  const blank = new Set(parsed.blankRowIndexes);

  for (let i = 0; i < parsed.rows.length; i++) {
    if (blank.has(i)) continue;
    const key = parsed.rows[i]!.join('\u0001');
    const entry = seen.get(key);
    if (entry) {
      entry.count++;
      if (entry.rows.length < DUP_ROW_EXAMPLES) entry.rows.push(i + 1);
    } else {
      seen.set(key, { rows: [i + 1], count: 1 });
    }
  }

  let duplicateRows = 0;
  let duplicateGroups = 0;
  const groups: DuplicateRowGroup[] = [];
  for (const [key, entry] of seen) {
    if (entry.count < 2) continue;
    duplicateGroups++;
    duplicateRows += entry.count - 1;
    if (groups.length < DUP_GROUP_CAP) {
      const firstIndex = entry.rows[0]! - 1;
      groups.push({
        example: parsed.rows[firstIndex]!.slice(),
        count: entry.count,
        rows: entry.rows.slice(),
      });
    }
    void key;
  }
  groups.sort((a, b) => b.count - a.count);

  return { duplicateRows, duplicateGroups, groups };
}

/** Build the dataset overview from the parse, profiles, duplicates, and findings. */
export function buildOverview(
  parsed: ParsedCsv,
  columns: ColumnProfile[],
  duplicates: DuplicateRowInfo,
  findings: CsvFinding[],
  meta: { fileName: string | null; fileSize: number | null; delimiterName: string },
): DatasetOverview {
  let populatedCells = 0;
  for (const col of columns) populatedCells += col.populated;
  const totalCells = parsed.columnCount * parsed.analyzedRows;
  const blankCells = Math.max(0, totalCells - populatedCells);

  const bySeverity: Record<FindingSeverity, number> = { info: 0, notice: 0, warning: 0 };
  for (const finding of findings) bySeverity[finding.severity]++;

  return {
    fileName: meta.fileName,
    fileSize: meta.fileSize,
    rows: parsed.analyzedRows,
    columns: parsed.columnCount,
    delimiter: parsed.delimiter,
    delimiterName: meta.delimiterName,
    lineBreak: parsed.lineBreakStyle,
    headerDetected: parsed.headerDetected,
    headerAssumed: parsed.headerAssumed,
    hasHeader: parsed.hasHeader,
    bom: parsed.bom,
    blankRows: parsed.blankRowIndexes.length,
    duplicateRows: duplicates.duplicateRows,
    duplicateGroups: duplicates.duplicateGroups,
    totalCells,
    populatedCells,
    blankCells,
    completeness: totalCells > 0 ? populatedCells / totalCells : 0,
    findingCount: findings.length,
    findingCountBySeverity: bySeverity,
    truncated: parsed.truncated,
    analyzedRows: parsed.analyzedRows,
  };
}

/** Preview cap: rows and columns rendered in the source preview. */
export const PREVIEW_ROWS = 50;
export const PREVIEW_COLS = 40;

export function buildPreview(parsed: ParsedCsv): PreviewData {
  const totalRows = parsed.analyzedRows;
  const shownRows = Math.min(totalRows, PREVIEW_ROWS);
  const totalColumns = parsed.columnCount;
  const shownColumns = Math.min(totalColumns, PREVIEW_COLS);

  const malformed = new Set(parsed.rowShapeIssues.map((issue) => issue.row));
  const blank = new Set(parsed.blankRowIndexes.map((i) => i + 1));

  const rows: string[][] = [];
  const rowNumbers: number[] = [];
  for (let i = 0; i < shownRows; i++) {
    const row = parsed.rows[i]!;
    const cells: string[] = [];
    for (let j = 0; j < shownColumns; j++) cells.push(row[j] ?? '');
    rows.push(cells);
    rowNumbers.push(i);
  }

  return {
    header: parsed.header.slice(0, shownColumns),
    rows,
    rowNumbers,
    shownRows,
    totalRows,
    truncatedRows: totalRows > shownRows,
    shownColumns,
    totalColumns,
    truncatedColumns: totalColumns > shownColumns,
    malformedRows: malformed,
    blankRows: blank,
  };
}
