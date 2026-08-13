/**
 * The diagnostic rules for CSV Autopsy.
 *
 * Each rule turns a structural or statistical observation into a `CsvFinding`
 * that carries not just *what* is wrong but *why* it was flagged and a few exact,
 * unmodified examples. The engine never repairs anything — a finding is a report,
 * not an edit.
 *
 * Severity is used sparingly. `warning` is reserved for genuinely consequential
 * problems (malformed rows, unclosed quotes, duplicate rows, a duplicated
 * identifier); most observations are `notice`, and purely-informational context
 * is `info`. Findings are ordered so the things that deserve attention first —
 * structural breakage, key violations, type anomalies — rise to the top, with
 * informational items settling to the bottom.
 */

import { formatNumber, formatPercent } from './format';
import {
  looksLikeStrongIdName,
  MIN_KEY_ROWS,
  type ColumnScan,
  type DuplicateRowInfo,
} from './profile';
import type {
  ColumnProfile,
  ColumnType,
  CsvFinding,
  FindingCategory,
  FindingExample,
  FindingSeverity,
  ParsedCsv,
} from './types';

const SEVERITY_TIER: Record<FindingSeverity, number> = { warning: 0, notice: 1, info: 2 };
const CATEGORY_BASE: Record<FindingCategory, number> = {
  structure: 0,
  headers: 1,
  uniqueness: 2,
  'type-integrity': 3,
  completeness: 4,
  duplicates: 5,
  consistency: 6,
  whitespace: 7,
};

function priorityFor(category: FindingCategory, severity: FindingSeverity): number {
  return SEVERITY_TIER[severity] * 1000 + CATEGORY_BASE[category] * 10;
}

/** ≥90% blank counts as "mostly empty". */
const MOSTLY_BLANK = 0.9;
/** A single value covering ≥95% of a column reads as "nearly constant". */
const NEAR_CONSTANT = 0.95;
/** Below this many populated values, constant/near-constant claims are not meaningful. */
const MIN_CONSTANT_ROWS = 4;
/** Mean value length above which a unique text column is free text, not an identifier. */
const FREE_TEXT_MEAN_LEN = 40;
/** Column is treated as identifier-shaped above this completeness. */
const KEY_SHAPE_COMPLETENESS = 0.95;
/** Example/cluster caps (exact counts always live in `count`). */
const EXAMPLE_CAP = 12;
const CLUSTER_CAP = 12;
const VARIANTS_PER_CLUSTER = 6;

const TYPE_LABELS: Record<ColumnType, string> = {
  integer: 'a whole number',
  decimal: 'a number',
  boolean: 'a boolean',
  date: 'a date',
  datetime: 'a date-time',
  text: 'text',
  mixed: 'mixed',
  empty: 'empty',
};

interface FindingSpec {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  detail: string;
  why: string;
  column?: string;
  columnIndex?: number;
  count?: number;
  examples?: FindingExample[];
  examplesTruncated?: boolean;
}

function make(spec: FindingSpec): CsvFinding {
  return {
    id: spec.id,
    severity: spec.severity,
    category: spec.category,
    title: spec.title,
    detail: spec.detail,
    why: spec.why,
    column: spec.column,
    columnIndex: spec.columnIndex,
    count: spec.count,
    examples: spec.examples ?? [],
    examplesTruncated: spec.examplesTruncated ?? false,
    priority: priorityFor(spec.category, spec.severity),
  };
}

function normalizeLoose(value: string): string {
  return value
    .toLowerCase()
    .replace(/[.,&/'"()[\]_\-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

interface Cluster {
  variants: string[];
  total: number;
}

function capitalizationClusters(freq: Map<string, number>): Cluster[] {
  const groups = new Map<string, Cluster>();
  for (const [value, count] of freq) {
    const key = value.toLowerCase();
    const group = groups.get(key) ?? { variants: [], total: 0 };
    group.variants.push(value);
    group.total += count;
    groups.set(key, group);
  }
  return [...groups.values()].filter((g) => g.variants.length > 1);
}

function looseClusters(freq: Map<string, number>): Cluster[] {
  const groups = new Map<string, { variants: string[]; total: number; lowers: Set<string> }>();
  for (const [value, count] of freq) {
    const key = normalizeLoose(value);
    if (key === '') continue;
    const group = groups.get(key) ?? { variants: [], total: 0, lowers: new Set<string>() };
    group.variants.push(value);
    group.total += count;
    group.lowers.add(value.trim().toLowerCase());
    groups.set(key, group);
  }
  // Keep only clusters that differ by more than capitalization or surrounding
  // whitespace alone — those are reported by the capitalization and whitespace
  // findings, so a genuine "similar values" cluster must vary in punctuation or
  // internal spacing (e.g. "St. Louis" vs "St Louis").
  return [...groups.values()]
    .filter((g) => g.variants.length > 1 && g.lowers.size > 1)
    .map((g) => ({ variants: g.variants, total: g.total }));
}

function clusterExamples(clusters: Cluster[]): { examples: FindingExample[]; truncated: boolean } {
  const examples: FindingExample[] = [];
  for (const cluster of clusters.slice(0, CLUSTER_CAP)) {
    const shown = cluster.variants.slice(0, VARIANTS_PER_CLUSTER);
    examples.push({
      value: shown.map((v) => `“${v}”`).join(' · '),
      note: `${cluster.variants.length} variants, ${cluster.total} rows`,
    });
  }
  return { examples, truncated: clusters.length > CLUSTER_CAP };
}

/** Find rows carrying each duplicated value in a key-shaped column. */
function duplicatedValueExamples(parsed: ParsedCsv, scan: ColumnScan): FindingExample[] {
  const dupValues = new Set<string>();
  for (const [value, count] of scan.freq) if (count >= 2) dupValues.add(value);
  if (dupValues.size === 0) return [];

  const rowsByValue = new Map<string, number[]>();
  for (let i = 0; i < parsed.rows.length; i++) {
    // Match on the exact value — freq is keyed on the exact string.
    const value = parsed.rows[i]![scan.index] ?? '';
    if (!dupValues.has(value)) continue;
    const list = rowsByValue.get(value) ?? [];
    if (list.length < 6) list.push(i + 1);
    rowsByValue.set(value, list);
  }

  const examples: FindingExample[] = [];
  const ordered = [...dupValues].sort(
    (a, b) => (scan.freq.get(b) ?? 0) - (scan.freq.get(a) ?? 0) || a.localeCompare(b),
  );
  for (const value of ordered.slice(0, EXAMPLE_CAP)) {
    const count = scan.freq.get(value) ?? 0;
    const rows = rowsByValue.get(value) ?? [];
    examples.push({
      value,
      note: `×${count} — rows ${rows.join(', ')}${count > rows.length ? ', …' : ''}`,
    });
  }
  return examples;
}

export interface FindingsInput {
  parsed: ParsedCsv;
  scans: ColumnScan[];
  columns: ColumnProfile[];
  duplicates: DuplicateRowInfo;
}

export function generateFindings(input: FindingsInput): CsvFinding[] {
  const { parsed, scans, columns, duplicates } = input;
  const findings: CsvFinding[] = [];

  // ── Structure ──────────────────────────────────────────────────────────
  if (parsed.rowShapeIssues.length > 0) {
    const examples = parsed.rowShapeIssues.slice(0, EXAMPLE_CAP).map((issue) => ({
      value: `${issue.fields} ${issue.fields === 1 ? 'field' : 'fields'}`,
      row: issue.row,
      note: `expected ${issue.expected}`,
    }));
    findings.push(
      make({
        id: 'structure-ds-rowshape',
        severity: 'warning',
        category: 'structure',
        title: 'Malformed rows',
        detail: `${formatNumber(parsed.rowShapeIssues.length)} ${parsed.rowShapeIssues.length === 1 ? 'row has' : 'rows have'} a different number of fields than the ${parsed.columnCount} columns.`,
        why: 'A row with too many or too few fields usually means an unescaped delimiter or a broken record; its cells no longer line up with the columns.',
        count: parsed.rowShapeIssues.length,
        examples,
        examplesTruncated: parsed.rowShapeIssues.length > EXAMPLE_CAP,
      }),
    );
  }

  const quoteIssues = parsed.parseIssues.filter((p) => p.kind === 'quotes');
  if (quoteIssues.length > 0) {
    findings.push(
      make({
        id: 'structure-ds-quotes',
        severity: 'warning',
        category: 'structure',
        title: 'Unclosed quoted field',
        detail: `${formatNumber(quoteIssues.length)} ${quoteIssues.length === 1 ? 'record has' : 'records have'} a quoted field that was never closed.`,
        why: 'An opening quote with no matching close makes the parser swallow the rest of the record (and sometimes following lines) as a single value.',
        count: quoteIssues.length,
        examples: quoteIssues
          .slice(0, EXAMPLE_CAP)
          .map((p) => ({ value: 'unterminated quote', row: p.row })),
      }),
    );
  }

  if (parsed.parseIssues.some((p) => p.kind === 'delimiter')) {
    findings.push(
      make({
        id: 'structure-ds-delimiter',
        severity: 'notice',
        category: 'structure',
        title: 'No delimiter detected',
        detail: 'The data could not be split into columns — it was read as a single column.',
        why: 'If this file is delimited, the delimiter is one the parser did not recognize; if it is a single column, this is expected.',
      }),
    );
  }

  if (parsed.blankRowIndexes.length > 0) {
    findings.push(
      make({
        id: 'structure-ds-blankrows',
        severity: 'info',
        category: 'structure',
        title: 'Blank rows',
        detail: `${formatNumber(parsed.blankRowIndexes.length)} ${parsed.blankRowIndexes.length === 1 ? 'row is' : 'rows are'} completely empty.`,
        why: 'Entirely empty rows are usually stray separators or artefacts of an export; they contribute nothing to any column.',
        count: parsed.blankRowIndexes.length,
        examples: parsed.blankRowIndexes
          .slice(0, EXAMPLE_CAP)
          .map((i) => ({ value: '(empty row)', row: i + 1 })),
        examplesTruncated: parsed.blankRowIndexes.length > EXAMPLE_CAP,
      }),
    );
  }

  if (!parsed.hasHeader) {
    findings.push(
      make({
        id: 'structure-ds-noheader',
        severity: 'info',
        category: 'structure',
        title: 'No header row',
        detail:
          'No header row was detected, so the first row is treated as data and columns are named Column 1…N.',
        why: 'The first row looked like data (or was ambiguous), so column names were synthesized rather than assumed.',
      }),
    );
  } else if (parsed.headerAssumed) {
    findings.push(
      make({
        id: 'structure-ds-headerassumed',
        severity: 'info',
        category: 'structure',
        title: 'Header row assumed',
        detail:
          'The first row was assumed to be a header, but the evidence was weak (an all-text table with no type contrast).',
        why: 'Without a clear type difference between the first row and the rows below, header detection is a best guess — double-check it.',
      }),
    );
  }

  if (parsed.bom) {
    findings.push(
      make({
        id: 'structure-ds-bom',
        severity: 'info',
        category: 'structure',
        title: 'Byte-order mark',
        detail: 'The file begins with a UTF-8 byte-order mark (BOM).',
        why: 'A leading BOM is harmless here but can trip up naïve parsers and show up as stray characters in the first header name.',
      }),
    );
  }

  if (parsed.delimiter && parsed.delimiter !== ',' && parsed.columnCount > 1) {
    const nameMap: Record<string, string> = {
      ';': 'semicolons',
      '\t': 'tabs',
      '|': 'pipes',
      ' ': 'spaces',
    };
    const label = nameMap[parsed.delimiter] ?? `“${parsed.delimiter}”`;
    findings.push(
      make({
        id: 'structure-ds-nonComma',
        severity: 'info',
        category: 'structure',
        title: 'Non-comma delimiter',
        detail: `Fields are separated by ${label}, not commas.`,
        why: 'The delimiter was auto-detected; this is a heads-up, not a problem.',
      }),
    );
  }

  if (parsed.truncated) {
    findings.push(
      make({
        id: 'structure-ds-truncated',
        severity: 'notice',
        category: 'structure',
        title: 'Analysis truncated',
        detail: `Only the first ${formatNumber(parsed.analyzedRows)} of ${formatNumber(parsed.totalRows)} rows were analyzed.`,
        why: 'The file exceeded the analysis row cap; counts and findings cover the analyzed prefix only.',
      }),
    );
  }

  // ── Headers ────────────────────────────────────────────────────────────
  if (parsed.hasHeader) {
    const trimmedNames = parsed.header.map((h) => h.trim());

    const exactGroups = new Map<string, number[]>();
    for (let j = 0; j < trimmedNames.length; j++) {
      const key = trimmedNames[j]!;
      if (key === '') continue;
      (exactGroups.get(key) ?? exactGroups.set(key, []).get(key)!).push(j);
    }
    const exactDupes = [...exactGroups.entries()].filter(([, idx]) => idx.length > 1);
    if (exactDupes.length > 0) {
      findings.push(
        make({
          id: 'headers-ds-duplicate',
          severity: 'warning',
          category: 'headers',
          title: 'Duplicate column names',
          detail: `${exactDupes.length} column ${exactDupes.length === 1 ? 'name is' : 'names are'} used more than once.`,
          why: 'Two columns with the same name are ambiguous — tools that key by column name will silently pick one and drop the other.',
          count: exactDupes.length,
          examples: exactDupes.slice(0, EXAMPLE_CAP).map(([name, idx]) => ({
            value: name,
            note: `columns ${idx.map((i) => i + 1).join(', ')}`,
          })),
        }),
      );
    }

    const caseGroups = new Map<string, Set<string>>();
    for (const name of trimmedNames) {
      if (name === '') continue;
      const key = name.toLowerCase();
      (caseGroups.get(key) ?? caseGroups.set(key, new Set()).get(key)!).add(name);
    }
    const caseDupes = [...caseGroups.values()].filter((set) => set.size > 1);
    if (caseDupes.length > 0) {
      findings.push(
        make({
          id: 'headers-ds-caseDuplicate',
          severity: 'notice',
          category: 'headers',
          title: 'Case-only duplicate headers',
          detail: `${caseDupes.length} header ${caseDupes.length === 1 ? 'name differs' : 'names differ'} from another only by capitalization.`,
          why: 'Case-insensitive tools (or a later normalization step) may treat these as the same column.',
          count: caseDupes.length,
          examples: caseDupes
            .slice(0, EXAMPLE_CAP)
            .map((set) => ({ value: [...set].map((s) => `“${s}”`).join(' · ') })),
        }),
      );
    }

    const blankHeaderCount = parsed.header.filter((h) => h.trim() === '').length;
    if (blankHeaderCount > 0) {
      findings.push(
        make({
          id: 'headers-ds-blank',
          severity: 'notice',
          category: 'headers',
          title: 'Blank column names',
          detail: `${blankHeaderCount} column ${blankHeaderCount === 1 ? 'has' : 'have'} no name in the header row.`,
          why: 'An unnamed column is hard to reference and often signals a stray delimiter or an export that dropped a label.',
          count: blankHeaderCount,
        }),
      );
    }

    const paddedHeaders = parsed.header
      .map((h, j) => ({ h, j }))
      .filter(({ h }) => h.length > 0 && h !== h.trim());
    if (paddedHeaders.length > 0) {
      findings.push(
        make({
          id: 'headers-ds-whitespace',
          severity: 'notice',
          category: 'headers',
          title: 'Whitespace in header names',
          detail: `${paddedHeaders.length} header ${paddedHeaders.length === 1 ? 'name has' : 'names have'} leading or trailing whitespace.`,
          why: 'Invisible padding in a header name breaks exact-name lookups even though the two names look identical.',
          count: paddedHeaders.length,
          examples: paddedHeaders
            .slice(0, EXAMPLE_CAP)
            .map(({ h, j }) => ({ value: `“${h}”`, note: `column ${j + 1}` })),
        }),
      );
    }
  }

  // ── Per-column rules ───────────────────────────────────────────────────
  for (const col of columns) {
    const scan = scans[col.index]!;

    // Uniqueness: candidate keys and duplicated identifiers.
    //
    // A column is "identifier-shaped" only when it is nearly fully populated,
    // nearly unique, and *either* named like a true id (id/key/uuid/…) or so
    // close to unique that a key is the only sensible reading. Weak id-ish names
    // (code/number/ref) do NOT lower the bar: postal_code, phone_number, and
    // area_code legitimately repeat, so they must clear the same 0.98 uniqueness
    // floor as any unnamed column before we call a repeat a broken key. The
    // distinct count must also be exact (an inexact, capped count is only a lower
    // bound and cannot prove a duplicate).
    const strongNameHint = looksLikeStrongIdName(col.name) && !col.synthesizedName;
    const freeText = col.dominantType === 'text' && col.meanLength > FREE_TEXT_MEAN_LEN;
    const keyShaped =
      col.populated >= MIN_KEY_ROWS &&
      col.completeness >= KEY_SHAPE_COMPLETENESS &&
      col.distinctExact &&
      !freeText &&
      col.uniqueness >= 0.9 &&
      (strongNameHint || col.uniqueness >= 0.98);

    if (keyShaped && col.uniqueness < 1) {
      const dupValues = col.populated - col.distinct;
      findings.push(
        make({
          id: `uniqueness-${col.index}-dupkey`,
          severity: 'warning',
          category: 'uniqueness',
          title: 'Duplicated identifier values',
          detail: `${col.name} is populated on ${formatPercent(col.completeness)} of rows and looks like an identifier, but ${formatNumber(dupValues)} ${dupValues === 1 ? 'value repeats' : 'values repeat'}.`,
          why: 'A column that looks like a key is expected to be unique; repeated values point to duplicated records or a data-entry error.',
          column: col.name,
          columnIndex: col.index,
          count: dupValues,
          examples: duplicatedValueExamples(parsed, scan),
        }),
      );
    } else if (col.candidateKey !== 'none' && col.uniqueness === 1) {
      findings.push(
        make({
          id: `uniqueness-${col.index}-candidatekey`,
          severity: 'info',
          category: 'uniqueness',
          title: col.candidateKey === 'strong' ? 'Likely identifier' : 'Possible identifier',
          detail: `${col.name} is ${formatPercent(col.completeness)} populated and ${formatPercent(col.uniqueness)} unique — ${col.candidateKey === 'strong' ? 'a strong record-identifier candidate' : 'a plausible record identifier'}.`,
          why: col.candidateKeyReason ?? 'Fully populated and fully unique.',
          column: col.name,
          columnIndex: col.index,
        }),
      );
    }

    // Type integrity: anomalies against a dominant type.
    const concreteTyped =
      col.dominantType === 'integer' ||
      col.dominantType === 'decimal' ||
      col.dominantType === 'date' ||
      col.dominantType === 'datetime' ||
      col.dominantType === 'boolean';
    if (concreteTyped && col.anomalyCount > 0) {
      // A dominant type is only assigned above 85% conformity, so a *few* clear
      // outliers in that column are most likely real errors (warning); a larger
      // minority reads more like a genuinely mixed column (notice).
      const fewOutliers = col.anomalyCount <= Math.max(3, Math.round(col.populated * 0.02));
      const severity: FindingSeverity = fewOutliers ? 'warning' : 'notice';
      findings.push(
        make({
          id: `type-integrity-${col.index}-anomaly`,
          severity,
          category: 'type-integrity',
          title: 'Values do not match the column type',
          detail: `${col.name} reads as ${TYPE_LABELS[col.dominantType]} on ${formatPercent(col.typeConformity)} of populated rows; ${formatNumber(col.anomalyCount)} ${col.anomalyCount === 1 ? 'value does' : 'values do'} not match.`,
          why: 'A column with a clear dominant type but a few non-conforming values usually has real data errors worth inspecting — not a genuinely mixed column.',
          column: col.name,
          columnIndex: col.index,
          count: col.anomalyCount,
          examples: col.anomalyExamples,
          examplesTruncated: col.anomalyCount > col.anomalyExamples.length,
        }),
      );
    } else if (col.dominantType === 'mixed' && col.populated > 0) {
      findings.push(
        make({
          id: `type-integrity-${col.index}-mixed`,
          severity: 'info',
          category: 'type-integrity',
          title: 'Mixed value types',
          detail: `${col.name} contains a mix of value types with no dominant one.`,
          why: 'No single type covers most of the column, so it is reported as mixed rather than forced into one.',
          column: col.name,
          columnIndex: col.index,
        }),
      );
    }

    // Completeness.
    if (col.populated === 0 && col.total > 0) {
      findings.push(
        make({
          id: `completeness-${col.index}-empty`,
          severity: 'notice',
          category: 'completeness',
          title: 'Empty column',
          detail: `${col.name} has no values — every one of its ${formatNumber(col.total)} cells is blank.`,
          why: 'A column that is entirely blank carries no information and is often a leftover from an export.',
          column: col.name,
          columnIndex: col.index,
          count: col.total,
        }),
      );
    } else if (col.populated > 0 && 1 - col.completeness >= MOSTLY_BLANK) {
      findings.push(
        make({
          id: `completeness-${col.index}-sparse`,
          severity: 'notice',
          category: 'completeness',
          title: 'Mostly blank column',
          detail: `${col.name} is blank on ${formatPercent(1 - col.completeness)} of rows (${formatNumber(col.populated)} of ${formatNumber(col.total)} populated).`,
          why: 'A column populated on only a small fraction of rows may be optional, deprecated, or misaligned.',
          column: col.name,
          columnIndex: col.index,
          count: col.blank,
        }),
      );
    }

    // Consistency: constant / near-constant, capitalization, similar values.
    if (col.isConstant && col.populated >= MIN_CONSTANT_ROWS) {
      const value = col.topValues[0]?.value ?? '';
      findings.push(
        make({
          id: `consistency-${col.index}-constant`,
          severity: 'info',
          category: 'consistency',
          title: 'Constant column',
          detail: `${col.name} is “${value}” on all ${formatNumber(col.populated)} populated rows.`,
          why: 'A single repeated value adds no distinguishing information — useful to know, occasionally a mistake.',
          column: col.name,
          columnIndex: col.index,
        }),
      );
    } else if (col.categorical && col.topValues.length > 0 && col.populated >= MIN_CONSTANT_ROWS) {
      const top = col.topValues[0]!;
      const share = top.count / col.populated;
      if (share >= NEAR_CONSTANT && !col.isConstant) {
        findings.push(
          make({
            id: `consistency-${col.index}-nearconstant`,
            severity: 'info',
            category: 'consistency',
            title: 'Nearly constant column',
            detail: `${col.name} is “${top.value}” on ${formatPercent(share)} of populated rows.`,
            why: 'One value dominates so heavily that the column is close to constant.',
            column: col.name,
            columnIndex: col.index,
          }),
        );
      }
    }

    // Capitalization / near-duplicate clustering is a text concept; applying it to
    // numeric or date columns would flag things like "1,000" vs "1000" as variants.
    if (col.categorical && (col.dominantType === 'text' || col.dominantType === 'mixed')) {
      const capClusters = capitalizationClusters(scan.freq);
      if (capClusters.length > 0) {
        const affected = capClusters.reduce((sum, c) => sum + c.variants.length, 0);
        const { examples, truncated } = clusterExamples(capClusters);
        findings.push(
          make({
            id: `consistency-${col.index}-caps`,
            severity: 'notice',
            category: 'consistency',
            title: 'Inconsistent capitalization',
            detail: `${col.name} has ${capClusters.length} ${capClusters.length === 1 ? 'value' : 'values'} written with inconsistent capitalization (${affected} spellings).`,
            why: 'The same category spelled with different capitalization splits into separate groups in any exact grouping or join.',
            column: col.name,
            columnIndex: col.index,
            count: capClusters.length,
            examples,
            examplesTruncated: truncated,
          }),
        );
      }

      const similar = looseClusters(scan.freq);
      if (similar.length > 0) {
        const { examples, truncated } = clusterExamples(similar);
        findings.push(
          make({
            id: `consistency-${col.index}-similar`,
            severity: 'notice',
            category: 'consistency',
            title: 'Suspiciously similar values',
            detail: `${col.name} has ${similar.length} ${similar.length === 1 ? 'group' : 'groups'} of values that differ only by punctuation or spacing.`,
            why: 'Values that normalize to the same text are very likely the same category entered inconsistently (fuzzy typo-matching is intentionally left out to avoid false positives).',
            column: col.name,
            columnIndex: col.index,
            count: similar.length,
            examples,
            examplesTruncated: truncated,
          }),
        );
      }
    }

    // Whitespace.
    if (scan.paddedCount > 0) {
      findings.push(
        make({
          id: `whitespace-${col.index}-padded`,
          severity: 'notice',
          category: 'whitespace',
          title: 'Leading or trailing whitespace',
          detail: `${col.name} has ${formatNumber(scan.paddedCount)} ${scan.paddedCount === 1 ? 'value' : 'values'} with surrounding whitespace.`,
          why: 'Invisible padding makes two otherwise-equal values compare as different and is easy to miss by eye.',
          column: col.name,
          columnIndex: col.index,
          count: scan.paddedCount,
          examples: scan.paddedExamples.map((ex) => ({ value: `“${ex.value}”`, row: ex.row })),
          examplesTruncated: scan.paddedCount > scan.paddedExamples.length,
        }),
      );
    }

    if (scan.whitespace > 0) {
      findings.push(
        make({
          id: `whitespace-${col.index}-only`,
          severity: 'notice',
          category: 'whitespace',
          title: 'Whitespace-only cells',
          detail: `${col.name} has ${formatNumber(scan.whitespace)} ${scan.whitespace === 1 ? 'cell' : 'cells'} containing only whitespace.`,
          why: 'A cell of only spaces or tabs looks blank but is not truly empty — it is counted as effectively blank and flagged as suspicious.',
          column: col.name,
          columnIndex: col.index,
          count: scan.whitespace,
          examples: scan.whitespaceRows
            .slice(0, EXAMPLE_CAP)
            .map((row) => ({ value: '(whitespace only)', row })),
          examplesTruncated: scan.whitespace > Math.min(scan.whitespaceRows.length, EXAMPLE_CAP),
        }),
      );
    }

    if (scan.wsSplit) {
      const variantValues: FindingExample[] = [];
      let variantCount = 0;
      for (const [value, split] of scan.wsSplit) {
        if (split.clean > 0 && split.padded > 0) {
          variantCount++;
          if (variantValues.length < EXAMPLE_CAP) {
            variantValues.push({
              value: `“${value}”`,
              note: `${split.clean} clean, ${split.padded} padded`,
            });
          }
        }
      }
      if (variantCount > 0) {
        findings.push(
          make({
            id: `whitespace-${col.index}-variants`,
            severity: 'notice',
            category: 'whitespace',
            title: 'Same value with and without whitespace',
            detail: `${col.name} has ${formatNumber(variantCount)} ${variantCount === 1 ? 'value that appears' : 'values that appear'} both padded and clean.`,
            why: 'The same value stored with and without surrounding whitespace will not match itself in a join or dedupe.',
            column: col.name,
            columnIndex: col.index,
            count: variantCount,
            examples: variantValues,
            examplesTruncated: variantCount > variantValues.length,
          }),
        );
      }
    }
  }

  // ── Completeness: null-like tokens (dataset-level, to avoid per-column noise) ──
  const nullLikeColumns = columns.filter((c) => scans[c.index]!.nullLike > 0);
  if (nullLikeColumns.length > 0) {
    const totalNullLike = nullLikeColumns.reduce((sum, c) => sum + scans[c.index]!.nullLike, 0);
    const tokens = new Set<string>();
    for (const c of nullLikeColumns) for (const t of scans[c.index]!.nullLikeTokens) tokens.add(t);
    findings.push(
      make({
        id: 'completeness-ds-nulllike',
        severity: 'info',
        category: 'completeness',
        title: 'Null-like tokens treated as blank',
        detail: `${formatNumber(totalNullLike)} ${totalNullLike === 1 ? 'value' : 'values'} across ${nullLikeColumns.length} ${nullLikeColumns.length === 1 ? 'column' : 'columns'} are null-like tokens (${[...tokens].map((t) => `“${t}”`).join(', ')}) and are counted as blank, not as data.`,
        why: 'Placeholder tokens like N/A or NULL are effectively missing values; recognizing them keeps completeness honest. They are reported, never rewritten.',
        count: totalNullLike,
        examples: nullLikeColumns.slice(0, EXAMPLE_CAP).map((c) => ({
          value: c.name,
          note: `${formatNumber(scans[c.index]!.nullLike)} null-like`,
        })),
      }),
    );
  }

  // ── Duplicates ─────────────────────────────────────────────────────────
  if (duplicates.duplicateRows > 0) {
    const examples: FindingExample[] = duplicates.groups.slice(0, EXAMPLE_CAP).map((group) => {
      const preview = group.example
        .slice(0, 4)
        .map((v) => (v.length > 24 ? `${v.slice(0, 24)}…` : v))
        .join(' | ');
      return {
        value: preview || '(row)',
        row: group.rows[0],
        note: `×${group.count} — rows ${group.rows.join(', ')}${group.count > group.rows.length ? ', …' : ''}`,
      };
    });
    findings.push(
      make({
        id: 'duplicates-ds-rows',
        severity: 'warning',
        category: 'duplicates',
        title: 'Exact duplicate rows',
        detail: `${formatNumber(duplicates.duplicateRows)} ${duplicates.duplicateRows === 1 ? 'row is an exact duplicate' : 'rows are exact duplicates'} of an earlier row, in ${formatNumber(duplicates.duplicateGroups)} ${duplicates.duplicateGroups === 1 ? 'group' : 'groups'}.`,
        why: 'Rows identical across every field are usually accidental re-imports or copy-paste errors and will double-count in any aggregate.',
        count: duplicates.duplicateRows,
        examples,
        examplesTruncated: duplicates.duplicateGroups > examples.length,
      }),
    );
  }

  // Sort by priority (severity tier, then category), then column, then title.
  findings.sort(
    (a, b) =>
      a.priority - b.priority ||
      (a.columnIndex ?? -1) - (b.columnIndex ?? -1) ||
      a.title.localeCompare(b.title),
  );

  // Link findings back to their columns.
  for (const finding of findings) {
    if (finding.columnIndex !== undefined) {
      const col = columns[finding.columnIndex];
      if (col) col.findingIds.push(finding.id);
    }
  }

  return findings;
}
