/**
 * Local, copy-to-clipboard exports for Diffoscope.
 *
 * `toSummaryReport` renders the human-readable findings surface as plain text:
 * the verdict, per-side statistics, and the located subtle differences. It is a
 * *description* of the comparison — never a patch, and never a modified input.
 * The line-oriented unified diff (see `unified-diff.ts`) is the separate,
 * clearly-labelled patch-format export.
 */

import type { ModeDiff, PairAnalysis, SubtleFinding, SubtlePosition } from './types';

const SEVERITY_LABEL = { warning: 'WARNING', notice: 'NOTICE', info: 'INFO' } as const;

function styleSummary(counts: PairAnalysis['a']['lineEndings']): string {
  if (counts.total === 0) return 'no line breaks';
  if (counts.mixed) return 'mixed line endings';
  return (counts.dominant ?? 'lf').toUpperCase();
}

function sideLine(label: string, side: PairAnalysis['a']): string {
  return `- ${label}: ${side.chars.toLocaleString()} chars, ${side.words.toLocaleString()} words, ${side.lines.toLocaleString()} lines (${styleSummary(side.lineEndings)})`;
}

function positionText(position: SubtlePosition): string {
  const parts: string[] = [];
  // Some findings (e.g. line-ending style) carry a line but no column.
  const sameLineNoColumn =
    position.aLine !== undefined &&
    position.aLine === position.bLine &&
    position.aColumn === undefined &&
    position.bColumn === undefined;
  if (sameLineNoColumn) {
    parts.push(`ln${position.aLine}`);
  } else {
    if (position.aLine !== undefined) {
      parts.push(
        `A ln${position.aLine}${position.aColumn !== undefined ? `:col${position.aColumn}` : ''}`,
      );
    }
    if (position.bLine !== undefined) {
      parts.push(
        `B ln${position.bLine}${position.bColumn !== undefined ? `:col${position.bColumn}` : ''}`,
      );
    }
  }
  if (position.note) parts.push(position.note);
  return parts.join(' / ');
}

function findingBlock(finding: SubtleFinding): string[] {
  const lines: string[] = [];
  lines.push(`- [${SEVERITY_LABEL[finding.severity]}] ${finding.title}`);
  lines.push(`  ${finding.detail}`);
  lines.push(`  Why: ${finding.why}`);
  const shown = finding.examples.slice(0, 5).map(positionText).filter(Boolean);
  if (shown.length > 0) {
    lines.push(`  At: ${shown.join('; ')}${finding.examplesTruncated ? '; …' : ''}`);
  }
  return lines;
}

/** Render the comparison as a plain-text summary report. */
export function toSummaryReport(analysis: PairAnalysis, diff?: ModeDiff): string {
  const lines: string[] = [];
  lines.push('Diffoscope comparison');
  lines.push('Generated locally in the browser — neither input was uploaded or modified.');
  lines.push('');
  lines.push(`Verdict: ${analysis.verdict.label} — ${analysis.verdict.headline}`);
  lines.push('');
  lines.push(sideLine('A / Before', analysis.a));
  lines.push(sideLine('B / After', analysis.b));
  lines.push('');

  if (diff) {
    if (diff.charDisabled) {
      lines.push('Comparison: character mode was skipped for this input size.');
    } else if (diff.equal) {
      lines.push(`Comparison (${diff.unit}): no differences under the current lens.`);
    } else {
      const changed = diff.mode === 'line' ? `, ${diff.changedLines ?? 0} changed lines` : '';
      lines.push(
        `Comparison (${diff.unit}): ${diff.inserted.toLocaleString()} inserted, ${diff.deleted.toLocaleString()} deleted, ${diff.changedRegions.toLocaleString()} changed ${diff.changedRegions === 1 ? 'region' : 'regions'}${changed}.`,
      );
    }
    lines.push('');
  }

  if (analysis.exactlyEqual) {
    lines.push('The two inputs are exactly identical.');
  } else if (analysis.charComparisonSkipped) {
    lines.push(
      'Subtle-character diagnostics were skipped (input too large for a per-character scan).',
    );
  } else if (analysis.findings.length === 0) {
    lines.push('No subtle character-level differences detected.');
  } else {
    lines.push(`Subtle differences (${analysis.findings.length}):`);
    for (const finding of analysis.findings) lines.push(...findingBlock(finding));
  }

  return lines.join('\n').trimEnd() + '\n';
}
