/**
 * Shared types for CSV Autopsy — a local-first CSV profiling and diagnostic
 * instrument.
 *
 * The engine's job is to *diagnose and explain*, never to repair. Nothing here
 * describes a transformation of the user's data; every type is about observing
 * structure, inferring types conservatively, and surfacing quality problems with
 * enough context to understand *why* each one was flagged.
 *
 * All analysis is deterministic and runs entirely in the browser. Offsets and
 * row numbers refer to the original, unmodified input.
 */

/** The dominant type inferred for a whole column. */
export type ColumnType =
  'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'text' | 'mixed' | 'empty';

/** The concrete type of a single populated cell value. */
export type ValueType = 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'text';

/** Why a cell counts as effectively blank. */
export type BlankKind = 'empty' | 'whitespace' | 'null-like';

/** The classification of any single cell. */
export type CellClass = ValueType | BlankKind;

/** Severity is deliberately restrained: reserve `warning` for consequential problems. */
export type FindingSeverity = 'info' | 'notice' | 'warning';

/** Numeric ordering so findings sort most-severe first. */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  warning: 2,
  notice: 1,
  info: 0,
};

/** Diagnostic families. Each finding belongs to exactly one. */
export type FindingCategory =
  | 'structure'
  | 'headers'
  | 'completeness'
  | 'uniqueness'
  | 'type-integrity'
  | 'consistency'
  | 'whitespace'
  | 'duplicates';

export interface FindingExample {
  /** The exact raw value, preserved from the source (never modified). */
  value: string;
  /** 1-based data-row number (excludes the header), when the example is a cell. */
  row?: number;
  /** Optional supporting note (e.g. "×3", "casing variant", "expected 6 fields"). */
  note?: string;
}

export interface CsvFinding {
  /** Stable id, unique within one analysis. */
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  /** Short human title (e.g. "Duplicate identifier values"). */
  title: string;
  /** Plain-language description, already interpolated with the measured counts. */
  detail: string;
  /** One sentence on *why* this was flagged — the rule behind it. */
  why: string;
  /** Affected column name, when the finding is column-scoped. */
  column?: string;
  /** Affected column index (0-based), when column-scoped. */
  columnIndex?: number;
  /** Magnitude the detail refers to (rows or values affected). */
  count?: number;
  /** Representative examples, capped (exact counts live in `count`). */
  examples: FindingExample[];
  /** True when the stored example list was truncated for a large input. */
  examplesTruncated: boolean;
  /** Sort key derived from severity + category; lower sorts first. */
  priority: number;
}

/** Per-column tally of populated cells by concrete value type. */
export interface TypeBreakdown {
  integer: number;
  decimal: number;
  boolean: number;
  date: number;
  datetime: number;
  text: number;
}

export interface NumericStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  zeros: number;
  negatives: number;
  /** How many values were accepted only after stripping currency/grouping/percent. */
  formatted: number;
}

export interface DateStats {
  /** Raw source value carrying the earliest parsed instant. */
  earliest: string;
  /** Raw source value carrying the latest parsed instant. */
  latest: string;
  /** Fraction of populated values that parsed as a date/datetime (0..1). */
  parseRate: number;
  /** True when at least one value carried a time component. */
  hasTime: boolean;
  /** Count of populated values that parsed successfully. */
  parsed: number;
}

export interface ValueCount {
  value: string;
  count: number;
}

export interface DuplicateRowGroup {
  /** A representative copy of the duplicated row (raw fields). */
  example: string[];
  /** Total number of identical copies (≥2). */
  count: number;
  /** 1-based row numbers where copies appear (capped). */
  rows: number[];
}

/** How strongly a column looks like a record identifier. */
export type CandidateKeyConfidence = 'strong' | 'possible' | 'none';

export interface ColumnProfile {
  index: number;
  name: string;
  /** True when the name was synthesized because no header was detected. */
  synthesizedName: boolean;
  dominantType: ColumnType;
  /** Fraction of populated cells matching the dominant type family (0..1). */
  typeConformity: number;
  typeBreakdown: TypeBreakdown;
  /** Number of data rows contributing a cell to this column. */
  total: number;
  populated: number;
  empty: number;
  whitespace: number;
  nullLike: number;
  /** empty + whitespace + null-like. */
  blank: number;
  /** populated / total (0..1). */
  completeness: number;
  /** Distinct populated values (exact unless `distinctExact` is false). */
  distinct: number;
  distinctExact: boolean;
  /** distinct / populated (0..1). */
  uniqueness: number;
  isConstant: boolean;
  /** Most common populated values; empty when the column is high-cardinality. */
  topValues: ValueCount[];
  /** True when cardinality is bounded enough to treat the column as categorical. */
  categorical: boolean;
  /** A few example populated values, in first-seen order. */
  sampleValues: string[];
  numeric?: NumericStats;
  dates?: DateStats;
  candidateKey: CandidateKeyConfidence;
  candidateKeyReason?: string;
  /** Populated cells outside the dominant type family. */
  anomalyCount: number;
  anomalyExamples: FindingExample[];
  /** Mean character length of populated (trimmed) values. */
  meanLength: number;
  /** Ids of findings that reference this column. */
  findingIds: string[];
}

export type LineBreakStyle = 'lf' | 'crlf' | 'cr' | 'mixed' | 'none';

export interface RowShapeIssue {
  /** 1-based data-row number. */
  row: number;
  /** Actual field count parsed for the row. */
  fields: number;
  /** Field count expected (the column count). */
  expected: number;
}

export interface ParseIssue {
  kind: 'quotes' | 'delimiter' | 'other';
  message: string;
  /** 1-based data-row number, when the parser localized the problem. */
  row?: number;
}

export interface ParsedCsv {
  /** Resolved column names (synthetic "Column N" when no header). */
  header: string[];
  /** The literal first row of the file, before header resolution. */
  rawFirstRow: string[];
  /** Data rows only (the header row is removed when `hasHeader`). */
  rows: string[][];
  hasHeader: boolean;
  /** True when a header was detected with confidence. */
  headerDetected: boolean;
  /** True when a header was used but the detection was a low-confidence assumption. */
  headerAssumed: boolean;
  /** The delimiter character actually used to split fields. */
  delimiter: string;
  /** The raw newline sequence the parser detected (`\r\n`, `\n`, `\r`, or ``). */
  lineBreak: string;
  lineBreakStyle: LineBreakStyle;
  bom: boolean;
  columnCount: number;
  rowShapeIssues: RowShapeIssue[];
  parseIssues: ParseIssue[];
  /** 0-based indexes (into `rows`) of rows whose every field is blank. */
  blankRowIndexes: number[];
  /** True when the row list was capped for a very large input. */
  truncated: boolean;
  /** Number of data rows actually analyzed. */
  analyzedRows: number;
  /** Number of data rows the file contained (before any cap). */
  totalRows: number;
}

export interface DatasetOverview {
  fileName: string | null;
  /** File size in bytes, when known. */
  fileSize: number | null;
  /** Data rows (excludes the header). */
  rows: number;
  columns: number;
  delimiter: string;
  delimiterName: string;
  lineBreak: LineBreakStyle;
  headerDetected: boolean;
  headerAssumed: boolean;
  hasHeader: boolean;
  bom: boolean;
  blankRows: number;
  /** Rows that exactly duplicate an earlier (non-blank) row. */
  duplicateRows: number;
  /** Groups of exact-duplicate rows (each group has ≥2 members). */
  duplicateGroups: number;
  totalCells: number;
  populatedCells: number;
  blankCells: number;
  /** populatedCells / totalCells (0..1). */
  completeness: number;
  findingCount: number;
  findingCountBySeverity: Record<FindingSeverity, number>;
  /** True when analysis was limited to a prefix of a very large file. */
  truncated: boolean;
  analyzedRows: number;
}

export interface PreviewData {
  header: string[];
  rows: string[][];
  /** 0-based indexes (into the analyzed rows) of the shown rows. */
  rowNumbers: number[];
  shownRows: number;
  totalRows: number;
  truncatedRows: boolean;
  shownColumns: number;
  totalColumns: number;
  truncatedColumns: boolean;
  /** Data-row indexes (1-based) known to be malformed, for subtle marking. */
  malformedRows: Set<number>;
  blankRows: Set<number>;
}

export interface AnalysisMeta {
  fileName: string | null;
  fileSize: number | null;
  /** True when the source is large enough that analysis may be slow. */
  large: boolean;
}

export interface CsvAnalysis {
  /** True when there is no input at all. */
  isEmpty: boolean;
  /** True when parsing produced nothing usable (e.g. no columns). */
  hadError: boolean;
  errorMessage?: string;
  overview: DatasetOverview;
  columns: ColumnProfile[];
  findings: CsvFinding[];
  preview: PreviewData;
  parse: ParsedCsv;
  meta: AnalysisMeta;
}
