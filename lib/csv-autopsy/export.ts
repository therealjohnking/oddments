/**
 * Diagnostic-report export for CSV Autopsy.
 *
 * The report describes the analysis — metadata, overview, column profiles, and
 * findings with a few examples. It is emphatically *not* a modified dataset:
 * CSV Autopsy inspects and explains, it never rewrites your data, and the export
 * reflects that. Two formats are offered — Markdown for reading, JSON for
 * machines — and both are generated locally.
 */

import { formatBytes, formatNumber, formatPercent } from './format';
import type { ColumnProfile, CsvAnalysis, CsvFinding, DatasetOverview } from './types';

const SEVERITY_LABEL: Record<CsvFinding['severity'], string> = {
  warning: 'WARNING',
  notice: 'NOTICE',
  info: 'INFO',
};

function overviewLines(overview: DatasetOverview): string[] {
  const lines: string[] = [];
  if (overview.fileName) lines.push(`- File: ${overview.fileName}`);
  if (overview.fileSize !== null) lines.push(`- Size: ${formatBytes(overview.fileSize)}`);
  lines.push(
    `- Rows: ${formatNumber(overview.rows)}${overview.truncated ? ' (analyzed prefix)' : ''}`,
  );
  lines.push(`- Columns: ${formatNumber(overview.columns)}`);
  lines.push(`- Delimiter: ${overview.delimiterName}`);
  lines.push(`- Line endings: ${overview.lineBreak.toUpperCase()}`);
  lines.push(
    `- Header: ${
      overview.hasHeader
        ? overview.headerDetected
          ? 'detected'
          : 'assumed'
        : 'none (synthesized names)'
    }`,
  );
  lines.push(`- Byte-order mark: ${overview.bom ? 'yes' : 'no'}`);
  lines.push(
    `- Completeness: ${formatPercent(overview.completeness)} (${formatNumber(overview.populatedCells)} of ${formatNumber(overview.totalCells)} cells populated)`,
  );
  lines.push(`- Blank rows: ${formatNumber(overview.blankRows)}`);
  lines.push(
    `- Duplicate rows: ${formatNumber(overview.duplicateRows)} in ${formatNumber(overview.duplicateGroups)} group(s)`,
  );
  const bySev = overview.findingCountBySeverity;
  lines.push(
    `- Findings: ${formatNumber(overview.findingCount)} (${bySev.warning} warning, ${bySev.notice} notice, ${bySev.info} info)`,
  );
  return lines;
}

function findingBlock(finding: CsvFinding): string[] {
  const lines: string[] = [];
  lines.push(`### [${SEVERITY_LABEL[finding.severity]}] ${finding.title}`);
  lines.push('');
  lines.push(`- Category: ${finding.category}`);
  if (finding.column) lines.push(`- Column: ${finding.column}`);
  if (finding.count !== undefined) lines.push(`- Count: ${formatNumber(finding.count)}`);
  lines.push(`- What: ${finding.detail}`);
  lines.push(`- Why: ${finding.why}`);
  if (finding.examples.length > 0) {
    lines.push('- Examples:');
    for (const ex of finding.examples) {
      const parts = [ex.value];
      if (ex.row !== undefined) parts.push(`(row ${ex.row})`);
      if (ex.note) parts.push(`— ${ex.note}`);
      lines.push(`  - ${parts.join(' ')}`);
    }
    if (finding.examplesTruncated) lines.push('  - … (more not shown)');
  }
  lines.push('');
  return lines;
}

function columnBlock(col: ColumnProfile): string[] {
  const lines: string[] = [];
  lines.push(`### ${col.name} — ${col.dominantType}`);
  lines.push('');
  lines.push(
    `- Completeness: ${formatPercent(col.completeness)} (${formatNumber(col.populated)} populated, ${formatNumber(col.blank)} blank)`,
  );
  lines.push(
    `- Distinct: ${formatNumber(col.distinct)}${col.distinctExact ? '' : '+'} (${formatPercent(col.uniqueness)} unique)`,
  );
  if (col.typeConformity < 1 && col.anomalyCount > 0) {
    lines.push(
      `- Type conformity: ${formatPercent(col.typeConformity)} (${formatNumber(col.anomalyCount)} non-conforming)`,
    );
  }
  if (col.candidateKey !== 'none') {
    lines.push(`- Candidate key: ${col.candidateKey} — ${col.candidateKeyReason ?? ''}`.trimEnd());
  }
  if (col.numeric) {
    const n = col.numeric;
    lines.push(
      `- Numeric: min ${formatNumber(n.min)}, max ${formatNumber(n.max)}, mean ${formatNumber(n.mean)}, median ${formatNumber(n.median)} (over ${formatNumber(n.count)} values)`,
    );
    if (n.zeros > 0 || n.negatives > 0) {
      lines.push(`  - Zeros: ${formatNumber(n.zeros)}, negatives: ${formatNumber(n.negatives)}`);
    }
    if (n.formatted > 0) {
      lines.push(
        `  - ${formatNumber(n.formatted)} accepted after removing currency/grouping/percent`,
      );
    }
  }
  if (col.dates) {
    const d = col.dates;
    lines.push(
      `- Dates: ${d.earliest} → ${d.latest} (${formatPercent(d.parseRate)} parsed${d.hasTime ? ', includes time' : ''})`,
    );
  }
  if (col.topValues.length > 0 && col.categorical) {
    const top = col.topValues
      .slice(0, 5)
      .map((v) => `${v.value} (${formatNumber(v.count)})`)
      .join(', ');
    lines.push(`- Top values: ${top}`);
  } else if (col.sampleValues.length > 0) {
    lines.push(`- Samples: ${col.sampleValues.slice(0, 5).join(', ')}`);
  }
  lines.push('');
  return lines;
}

/** Render the analysis as a Markdown diagnostic report. */
export function toMarkdownReport(analysis: CsvAnalysis): string {
  const { overview, columns, findings } = analysis;
  const lines: string[] = [];
  lines.push('# CSV Autopsy report');
  lines.push('');
  lines.push(
    `Local diagnostic report${overview.fileName ? ` for \`${overview.fileName}\`` : ''}. Generated in the browser — the dataset was never uploaded, and nothing here modifies it.`,
  );
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(...overviewLines(overview));
  lines.push('');

  lines.push('## Findings');
  lines.push('');
  if (findings.length === 0) {
    lines.push('No diagnostic findings — nothing suspicious surfaced.');
    lines.push('');
  } else {
    for (const finding of findings) lines.push(...findingBlock(finding));
  }

  lines.push('## Columns');
  lines.push('');
  for (const col of columns) lines.push(...columnBlock(col));

  return lines.join('\n').trimEnd() + '\n';
}

/** Render the analysis as a compact JSON diagnostic report (no raw dataset). */
export function toJsonReport(analysis: CsvAnalysis): string {
  const { overview, columns, findings } = analysis;
  const payload = {
    tool: 'CSV Autopsy',
    note: 'Diagnostic report only — the original dataset is not included and was not modified.',
    overview,
    columns: columns.map((col) => ({
      name: col.name,
      index: col.index,
      dominantType: col.dominantType,
      typeConformity: col.typeConformity,
      typeBreakdown: col.typeBreakdown,
      total: col.total,
      populated: col.populated,
      blank: col.blank,
      completeness: col.completeness,
      distinct: col.distinct,
      distinctExact: col.distinctExact,
      uniqueness: col.uniqueness,
      isConstant: col.isConstant,
      candidateKey: col.candidateKey,
      candidateKeyReason: col.candidateKeyReason,
      anomalyCount: col.anomalyCount,
      numeric: col.numeric,
      dates: col.dates,
      topValues: col.categorical ? col.topValues : undefined,
      sampleValues: col.sampleValues,
    })),
    findings: findings.map((finding) => ({
      severity: finding.severity,
      category: finding.category,
      title: finding.title,
      detail: finding.detail,
      why: finding.why,
      column: finding.column,
      count: finding.count,
      examples: finding.examples,
      examplesTruncated: finding.examplesTruncated,
    })),
  };
  return JSON.stringify(payload, null, 2);
}
