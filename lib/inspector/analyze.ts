import { CATEGORY_META, SEVERITY_RANK, countsTowardHeadline, type CategoryId } from './categories';
import { classify } from './classify';
import { countGraphemes, countCodePoints, utf8ByteLength } from './format';
import type {
  Analysis,
  CategorySummary,
  Finding,
  LineEndingSummary,
  LineInfo,
  LineTerminator,
  Stats,
  TrailingWhitespace,
} from './types';

export interface AnalyzeOptions {
  /** Cap on stored findings (counts stay exact beyond it). */
  maxFindings?: number;
  /** Cap on rendered line records (counts stay exact beyond it). */
  maxLines?: number;
  /** Above this UTF-16 length, skip the (costlier) grapheme count. */
  graphemeLimit?: number;
}

const DEFAULT_MAX_FINDINGS = 20_000;
const DEFAULT_MAX_LINES = 50_000;
const DEFAULT_GRAPHEME_LIMIT = 200_000;

const TRAILING_WS = /[ \t]+$/;

function emptyAnalysis(): Analysis {
  return {
    isEmpty: true,
    stats: {
      codePoints: 0,
      utf16Units: 0,
      bytes: 0,
      graphemes: 0,
      lines: 0,
      words: 0,
      asciiSpaces: 0,
      tabs: 0,
    },
    lineEndings: { lf: 0, cr: 0, crlf: 0, total: 0, dominant: null, mixed: false },
    bom: false,
    findings: [],
    categorySummaries: [],
    headlineCount: 0,
    lines: [],
    trailingWhitespace: [],
    findingsCapped: false,
    linesCapped: false,
  };
}

function countWords(input: string): number {
  const trimmed = input.trim();
  if (trimmed === '') return 0;
  return trimmed.split(/\s+/u).length;
}

function summarize(counts: Map<CategoryId, number>): CategorySummary[] {
  const summaries: CategorySummary[] = [];
  for (const [category, count] of counts) {
    const meta = CATEGORY_META[category];
    summaries.push({
      category,
      label: meta.label,
      description: meta.description,
      severity: meta.severity,
      group: meta.group,
      count,
    });
  }
  summaries.sort((a, b) => {
    const bySeverity = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
    if (bySeverity !== 0) return bySeverity;
    if (b.count !== a.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
  return summaries;
}

function summarizeLineEndings(lf: number, cr: number, crlf: number): LineEndingSummary {
  const total = lf + cr + crlf;
  const styles: [Exclude<LineTerminator, 'none'>, number][] = [
    ['lf', lf],
    ['crlf', crlf],
    ['cr', cr],
  ];
  let dominant: Exclude<LineTerminator, 'none'> | null = null;
  let best = 0;
  for (const [style, n] of styles) {
    if (n > best) {
      best = n;
      dominant = style;
    }
  }
  const mixed = styles.filter(([, n]) => n > 0).length > 1;
  return { lf, cr, crlf, total, dominant, mixed };
}

/**
 * Analyze text in a single pass: classify every notable code point, split into
 * lines (tracking line-ending style and trailing whitespace), and accumulate
 * statistics. Detection is exact for the whole input; only the stored `findings`
 * and `lines` arrays are capped for pathologically large inputs (the summary
 * counts remain exact).
 */
export function analyzeText(input: string, options: AnalyzeOptions = {}): Analysis {
  if (input.length === 0) return emptyAnalysis();

  const maxFindings = options.maxFindings ?? DEFAULT_MAX_FINDINGS;
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES;
  const graphemeLimit = options.graphemeLimit ?? DEFAULT_GRAPHEME_LIMIT;

  const counts = new Map<CategoryId, number>();
  const findings: Finding[] = [];
  const lines: LineInfo[] = [];
  const trailingWhitespace: TrailingWhitespace[] = [];
  let findingsCapped = false;
  let linesCapped = false;

  let asciiSpaces = 0;
  let tabs = 0;
  let lf = 0;
  let cr = 0;
  let crlf = 0;
  let lineCountTotal = 0;

  const bom = input.codePointAt(0) === 0xfeff;

  // Per-line mutable state.
  let lineStartOffset = 0;
  let lineNumber = 1;
  let colCP = 0;
  let lineFindings: Finding[] = [];

  const pushFinding = (finding: Finding): void => {
    counts.set(finding.category, (counts.get(finding.category) ?? 0) + 1);
    if (findings.length < maxFindings) {
      findings.push(finding);
      lineFindings.push(finding);
    } else {
      findingsCapped = true;
    }
  };

  const buildFinding = (
    category: CategoryId,
    codePoint: number,
    name: string,
    abbr: string,
    offset: number,
    looksLike?: string,
  ): Finding => ({
    id: `f${offset}`,
    category,
    codePoint,
    char: String.fromCodePoint(codePoint),
    name,
    abbr,
    looksLike,
    offset,
    line: lineNumber,
    column: colCP + 1,
  });

  const closeLine = (contentEndOffset: number, terminator: LineTerminator): void => {
    lineCountTotal += 1;
    if (lines.length >= maxLines) {
      linesCapped = true;
      lineFindings = [];
      return;
    }
    const text = input.slice(lineStartOffset, contentEndOffset);
    let trailing: TrailingWhitespace | null = null;
    const match = TRAILING_WS.exec(text);
    if (match) {
      const runLength = match[0].length; // ASCII run: code points == UTF-16 units
      trailing = {
        line: lineNumber,
        column: colCP - runLength + 1,
        offset: lineStartOffset + (text.length - runLength),
        length: runLength,
        text: match[0],
      };
      trailingWhitespace.push(trailing);
    }
    lines.push({
      index: lineNumber - 1,
      number: lineNumber,
      text,
      startOffset: lineStartOffset,
      terminator,
      findings: lineFindings,
      trailing,
      codePointLength: colCP,
    });
    lineFindings = [];
  };

  const advanceLine = (nextOffset: number): void => {
    lineStartOffset = nextOffset;
    lineNumber += 1;
    colCP = 0;
    lineFindings = [];
  };

  const len = input.length;
  let i = 0;
  while (i < len) {
    const cp = input.codePointAt(i);
    if (cp === undefined) break;
    const width = cp > 0xffff ? 2 : 1;

    if (cp === 0x0d) {
      const isCRLF = i + 1 < len && input.charCodeAt(i + 1) === 0x0a;
      if (isCRLF) crlf += 1;
      else cr += 1;
      closeLine(i, isCRLF ? 'crlf' : 'cr');
      i += isCRLF ? 2 : 1;
      advanceLine(i);
      continue;
    }
    if (cp === 0x0a) {
      lf += 1;
      closeLine(i, 'lf');
      i += 1;
      advanceLine(i);
      continue;
    }

    if (cp === 0x20) {
      asciiSpaces += 1;
    } else if (cp === 0x09) {
      tabs += 1;
      pushFinding(buildFinding('tab', 0x09, 'Character tabulation (tab)', 'TAB', i));
    } else if (cp === 0xfeff && i === 0) {
      pushFinding(buildFinding('bom', 0xfeff, 'Byte-order mark', 'BOM', i));
    } else {
      const classification = classify(cp);
      if (classification) {
        pushFinding(
          buildFinding(
            classification.category,
            cp,
            classification.name,
            classification.abbr,
            i,
            classification.looksLike,
          ),
        );
      }
    }

    colCP += 1;
    i += width;
  }

  // Final line (the segment after the last terminator; may be empty).
  closeLine(len, 'none');

  const utf16Units = input.length;
  const graphemes = utf16Units > graphemeLimit ? countCodePoints(input) : countGraphemes(input);

  const stats: Stats = {
    codePoints: countCodePoints(input),
    utf16Units,
    bytes: utf8ByteLength(input),
    graphemes,
    lines: lineCountTotal,
    words: countWords(input),
    asciiSpaces,
    tabs,
  };

  let headlineCount = 0;
  for (const [category, count] of counts) {
    if (countsTowardHeadline(category)) headlineCount += count;
  }

  return {
    isEmpty: false,
    stats,
    lineEndings: summarizeLineEndings(lf, cr, crlf),
    bom,
    findings,
    categorySummaries: summarize(counts),
    headlineCount,
    lines,
    trailingWhitespace,
    findingsCapped,
    linesCapped,
  };
}
