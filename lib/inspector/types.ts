import type { CategoryGroup, CategoryId, Severity } from './categories';

export type LineTerminator = 'lf' | 'cr' | 'crlf' | 'none';

export interface Finding {
  /** Stable id derived from the UTF-16 offset (unique within one analysis). */
  id: string;
  category: CategoryId;
  codePoint: number;
  /** The actual substring (one or two UTF-16 units). */
  char: string;
  name: string;
  /** Resolved short marker text for the reveal view. */
  abbr: string;
  /** For confusables: the ASCII character this one imitates. */
  looksLike?: string;
  /** UTF-16 index within the original input. */
  offset: number;
  /** 1-based line number. */
  line: number;
  /** 1-based code-point column within the line. */
  column: number;
}

export interface TrailingWhitespace {
  line: number;
  /** 1-based code-point column where the trailing run starts. */
  column: number;
  offset: number;
  /** Number of characters in the run (ASCII space/tab, so code points == units). */
  length: number;
  text: string;
}

export interface LineInfo {
  /** 0-based index. */
  index: number;
  /** 1-based line number. */
  number: number;
  /** Line content, excluding its terminator. */
  text: string;
  startOffset: number;
  terminator: LineTerminator;
  findings: Finding[];
  trailing: TrailingWhitespace | null;
  /** Code-point length of the line content. */
  codePointLength: number;
}

export interface CategorySummary {
  category: CategoryId;
  label: string;
  description: string;
  severity: Severity;
  group: CategoryGroup;
  count: number;
}

export interface LineEndingSummary {
  lf: number;
  cr: number;
  crlf: number;
  total: number;
  dominant: Exclude<LineTerminator, 'none'> | null;
  mixed: boolean;
}

export interface Stats {
  codePoints: number;
  utf16Units: number;
  bytes: number;
  graphemes: number;
  lines: number;
  words: number;
  asciiSpaces: number;
  tabs: number;
}

export interface Analysis {
  isEmpty: boolean;
  stats: Stats;
  lineEndings: LineEndingSummary;
  /** True when the input begins with a U+FEFF byte-order mark. */
  bom: boolean;
  /** Notable findings across the whole document, in document order. */
  findings: Finding[];
  /** Per-category counts for categories that occur, sorted most-severe first. */
  categorySummaries: CategorySummary[];
  /** Count of findings that count toward the "hidden & unusual" headline. */
  headlineCount: number;
  lines: LineInfo[];
  trailingWhitespace: TrailingWhitespace[];
  /** True when the findings list was capped (very large input). */
  findingsCapped: boolean;
  /** True when the rendered line list was capped (very large input). */
  linesCapped: boolean;
}
