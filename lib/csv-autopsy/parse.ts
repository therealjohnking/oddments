/**
 * CSV parsing for CSV Autopsy, layered on Papa Parse.
 *
 * Why Papa Parse rather than a hand-rolled parser: correct CSV tokenization is a
 * genuine state machine — quoted fields with embedded commas and newlines,
 * doubled-quote escaping, mixed line endings, delimiter auto-detection — and
 * getting every corner right is exactly where a mature, widely-used library
 * earns its place. Papa Parse is MIT-licensed, has zero runtime dependencies,
 * and (as used here) never touches the network: we only ever hand it a *string*,
 * never a URL or a worker.
 *
 * Everything above tokenization — header detection, blank/ragged-row accounting,
 * duplicate detection, and every diagnostic — is Oddments' own, computed from the
 * raw `string[][]` Papa returns. We parse with `header: false` on purpose so the
 * engine sees the literal first row and can report duplicate/blank/whitespace
 * headers itself instead of letting the parser silently rename them.
 */

import Papa from 'papaparse';
import { classifyCell, isBlankClass } from './infer';
import type { LineBreakStyle, ParsedCsv, ParseIssue, RowShapeIssue } from './types';

export interface ParseOptions {
  /** 'auto' detects a header; 'header'/'no-header' force the interpretation. */
  headerMode?: 'auto' | 'header' | 'no-header';
  /** Hard cap on data rows analyzed. Extra rows are ignored and `truncated` is set. */
  maxRows?: number;
}

/** Default ceiling on analyzed rows — high enough for real files, low enough to stay responsive. */
export const DEFAULT_MAX_ROWS = 500_000;

export function delimiterName(delimiter: string): string {
  switch (delimiter) {
    case ',':
      return 'comma';
    case ';':
      return 'semicolon';
    case '\t':
      return 'tab';
    case '|':
      return 'pipe';
    case ' ':
      return 'space';
    case '':
      return 'none';
    default:
      return `“${delimiter}”`;
  }
}

/** Classify the newline convention from the raw input (detects genuinely mixed files). */
export function detectLineBreakStyle(input: string): LineBreakStyle {
  const crlf = (input.match(/\r\n/g) ?? []).length;
  const withoutCrlf = input.replace(/\r\n/g, '');
  const cr = (withoutCrlf.match(/\r/g) ?? []).length;
  const lf = (withoutCrlf.match(/\n/g) ?? []).length;
  const kinds = (crlf > 0 ? 1 : 0) + (cr > 0 ? 1 : 0) + (lf > 0 ? 1 : 0);
  if (kinds === 0) return 'none';
  if (kinds > 1) return 'mixed';
  if (crlf > 0) return 'crlf';
  if (lf > 0) return 'lf';
  return 'cr';
}

function isBlankRow(row: string[]): boolean {
  return row.every((cell) => cell.trim().length === 0);
}

interface HeaderDecision {
  hasHeader: boolean;
  detected: boolean;
  assumed: boolean;
}

/**
 * Decide whether the first row is a header. The strongest signal is a *type
 * contrast*: a first-row cell that reads as text sitting above a column whose
 * body is mostly numeric/date/boolean. Absent that (e.g. an all-text table), a
 * fully-populated, all-distinct first row is *assumed* to be a header, and we say
 * so rather than claiming certainty.
 */
function detectHeader(firstRow: string[], dataRows: string[][]): HeaderDecision {
  const noHeader: HeaderDecision = { hasHeader: false, detected: false, assumed: false };
  if (firstRow.length === 0) return noHeader;

  const firstClasses = firstRow.map((c) => classifyCell(c.trim()));
  // Note: a blank cell is not 'text', so a header with a blank name is not
  // "all text" — but it can still be detected via type contrast below, which is
  // what lets us later report the blank header rather than mis-reading the row.
  const allNonBlank = firstRow.every((c) => c.trim().length > 0);
  const firstAllText = firstClasses.every((cls) => cls === 'text');
  const distinct = new Set(firstRow.map((c) => c.trim().toLowerCase())).size === firstRow.length;

  if (dataRows.length === 0) {
    // A single non-blank row: treat an all-text, all-distinct row as a header-only file.
    if (allNonBlank && firstAllText && distinct)
      return { hasHeader: true, detected: true, assumed: false };
    return noHeader;
  }

  // Strongest signal: a text header cell sitting above a mostly non-text column.
  let contrastCols = 0;
  const sample = dataRows.slice(0, 50);
  for (let j = 0; j < firstRow.length; j++) {
    if (firstClasses[j] !== 'text') continue;
    let typed = 0;
    let populated = 0;
    for (const row of sample) {
      const cls = classifyCell(row[j] ?? '');
      if (isBlankClass(cls)) continue;
      populated++;
      if (cls !== 'text') typed++;
    }
    if (populated >= 3 && typed / populated >= 0.7) contrastCols++;
  }
  if (contrastCols > 0) return { hasHeader: true, detected: true, assumed: false };

  // No type contrast (e.g. an all-text table): a fully-populated, all-distinct,
  // all-text first row is *assumed* to be a header, and we say the evidence is weak.
  if (allNonBlank && firstAllText && distinct)
    return { hasHeader: true, detected: false, assumed: true };
  return noHeader;
}

function modalRowLength(rows: string[][]): number {
  const counts = new Map<number, number>();
  for (const row of rows) {
    if (isBlankRow(row)) continue;
    counts.set(row.length, (counts.get(row.length) ?? 0) + 1);
  }
  let best = 0;
  let bestCount = -1;
  for (const [len, count] of counts) {
    if (count > bestCount || (count === bestCount && len > best)) {
      best = len;
      bestCount = count;
    }
  }
  return best;
}

/** Parse raw CSV text into a structural, diagnostic-ready representation. */
export function parseCsv(input: string, options: ParseOptions = {}): ParsedCsv {
  const headerMode = options.headerMode ?? 'auto';
  const maxRows = options.maxRows ?? DEFAULT_MAX_ROWS;

  const bom = input.charCodeAt(0) === 0xfeff;
  const body = bom ? input.slice(1) : input;
  const lineBreakStyle = detectLineBreakStyle(body);

  const result = Papa.parse<string[]>(body, {
    header: false,
    skipEmptyLines: false,
    dynamicTyping: false,
    delimiter: '',
    quoteChar: '"',
    escapeChar: '"',
  });

  let allRows = result.data;

  // Papa emits a spurious trailing single-empty-field row for the file's
  // terminating newline. Drop exactly that artifact (only when the input really
  // ends in a break), so a genuine blank line mid-file is still counted.
  const endsWithBreak = /(\r\n|\n|\r)$/.test(body);
  if (endsWithBreak && allRows.length > 0) {
    const last = allRows[allRows.length - 1]!;
    if (last.length === 1 && last[0] === '') allRows = allRows.slice(0, -1);
  }

  const delimiter = result.meta.delimiter ?? ',';
  const rawFirstRow = allRows.length > 0 ? allRows[0]! : [];

  // Header interpretation.
  let decision: HeaderDecision;
  if (allRows.length === 0) {
    decision = { hasHeader: false, detected: false, assumed: false };
  } else if (headerMode === 'header') {
    decision = { hasHeader: true, detected: false, assumed: false };
  } else if (headerMode === 'no-header') {
    decision = { hasHeader: false, detected: false, assumed: false };
  } else {
    decision = detectHeader(rawFirstRow, allRows.slice(1));
  }

  const bodyRows = decision.hasHeader ? allRows.slice(1) : allRows;
  const columnCount = decision.hasHeader ? rawFirstRow.length : modalRowLength(allRows);

  // Names: real header names (kept raw so header diagnostics can see whitespace),
  // or synthesized "Column N" placeholders.
  const header: string[] = decision.hasHeader
    ? rawFirstRow.slice()
    : Array.from({ length: columnCount }, (_, i) => `Column ${i + 1}`);

  // Row cap (analysis stays a prefix of very large files).
  const totalRows = bodyRows.length;
  const truncated = totalRows > maxRows;
  const rows = truncated ? bodyRows.slice(0, maxRows) : bodyRows;
  const analyzedRows = rows.length;

  // Blank + ragged accounting over the analyzed rows.
  const blankRowIndexes: number[] = [];
  const rowShapeIssues: RowShapeIssue[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    if (isBlankRow(row)) {
      blankRowIndexes.push(i);
    } else if (columnCount > 0 && row.length !== columnCount) {
      rowShapeIssues.push({ row: i + 1, fields: row.length, expected: columnCount });
    }
  }

  // Translate the parser's own warnings into Oddments findings-in-waiting.
  const parseIssues: ParseIssue[] = [];
  const dataRowNumber = (papaIndex: number): number =>
    decision.hasHeader ? papaIndex : papaIndex + 1;
  for (const err of result.errors) {
    if (err.type === 'Quotes') {
      parseIssues.push({
        kind: 'quotes',
        message:
          'A quoted field was not closed properly, so the rest of the record was read as one value.',
        row: typeof err.row === 'number' ? dataRowNumber(err.row) : undefined,
      });
    } else if (err.type === 'Delimiter' && columnCount <= 1) {
      // Papa flags low-confidence delimiter detection constantly; only surface it
      // when it actually failed to split the data into more than one column.
      parseIssues.push({
        kind: 'delimiter',
        message: 'No delimiter could be detected — the data was read as a single column.',
      });
    }
  }

  return {
    header,
    rawFirstRow,
    rows,
    hasHeader: decision.hasHeader,
    headerDetected: decision.detected,
    headerAssumed: decision.assumed,
    delimiter,
    lineBreak: result.meta.linebreak ?? '',
    lineBreakStyle,
    bom,
    columnCount,
    rowShapeIssues,
    parseIssues,
    blankRowIndexes,
    truncated,
    analyzedRows,
    totalRows,
  };
}
