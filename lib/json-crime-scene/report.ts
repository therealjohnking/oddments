/**
 * Diagnostic-report export. The report describes the *analysis* — metadata,
 * structural overview, findings, structural highlights, and shape observations.
 * It is emphatically not the document: the user's JSON source is never embedded,
 * so sharing a report never leaks the data it describes. Two formats are offered,
 * Markdown for reading and JSON for machines, both generated locally.
 */

import { formatBytes, formatInt, formatPercent } from './format';
import type { ArrayShapeReport, JsonAnalysis, JsonFinding, StructuralProfile } from './types';

const SEVERITY_LABEL = { warning: 'WARNING', notice: 'NOTICE', info: 'INFO' } as const;

function statusNote(analysis: JsonAnalysis): string {
  switch (analysis.status) {
    case 'empty':
      return 'No JSON was provided.';
    case 'error':
      return `The document is not valid JSON: ${analysis.error.message} (line ${analysis.error.position.line}, column ${analysis.error.position.column}).`;
    case 'too-complex':
      return 'The document is valid but too deeply nested to analyze safely in the browser.';
    default:
      return '';
  }
}

function overviewLines(profile: StructuralProfile, fileName: string | null): string[] {
  const lines: string[] = [];
  if (fileName) lines.push(`- File: ${fileName}`);
  lines.push(`- Root type: ${profile.rootKind}`);
  lines.push(`- Total values: ${formatInt(profile.totalNodes)}`);
  lines.push(
    `- Value mix: ${formatInt(profile.objects)} objects, ${formatInt(profile.arrays)} arrays, ${formatInt(profile.strings)} strings, ${formatInt(profile.numbers)} numbers, ${formatInt(profile.booleans)} booleans, ${formatInt(profile.nulls)} nulls`,
  );
  lines.push(`- Object properties: ${formatInt(profile.properties)}`);
  lines.push(
    `- Maximum depth: ${profile.maxDepth}${profile.deepest ? ` (at ${pointerLabel(profile.deepest.pointer)})` : ''}`,
  );
  lines.push(`- Source size: ${formatBytes(profile.sourceBytes)}`);
  lines.push(`- Duplicate-key groups: ${formatInt(profile.duplicateKeyGroups)}`);
  const bySev = profile.findingCountBySeverity;
  lines.push(
    `- Findings: ${formatInt(profile.findingCount)} (${bySev.warning} warning, ${bySev.notice} notice, ${bySev.info} info)`,
  );
  return lines;
}

function findingBlock(finding: JsonFinding): string[] {
  const lines: string[] = [];
  lines.push(`### [${SEVERITY_LABEL[finding.severity]}] ${finding.title}`);
  lines.push('');
  lines.push(`- Category: ${finding.category}`);
  if (finding.count !== undefined) lines.push(`- Count: ${formatInt(finding.count)}`);
  lines.push(`- What: ${finding.detail}`);
  lines.push(`- Why: ${finding.why}`);
  if (finding.examples.length > 0) {
    lines.push('- Examples:');
    for (const ex of finding.examples) {
      const head = ex.label ? `${ex.label}` : pointerLabel(ex.pointer);
      const note = ex.note ? ` — ${ex.note}` : '';
      const at = ex.label ? ` (${pointerLabel(ex.pointer)})` : '';
      lines.push(`  - ${head}${note}${at}`);
    }
    if (finding.examplesTruncated) lines.push('  - … (more not shown; the count above is exact)');
  }
  lines.push('');
  return lines;
}

function highlightLines(profile: StructuralProfile): string[] {
  const lines: string[] = [];
  if (profile.largestArray) {
    lines.push(
      `- Largest array: ${formatInt(profile.largestArray.value)} elements at ${pointerLabel(profile.largestArray.pointer)}`,
    );
  }
  if (profile.largestObject) {
    lines.push(
      `- Largest object: ${formatInt(profile.largestObject.value)} properties at ${pointerLabel(profile.largestObject.pointer)}`,
    );
  }
  if (profile.longestString) {
    lines.push(
      `- Longest string: ${formatInt(profile.longestString.value)} characters at ${pointerLabel(profile.longestString.pointer)}`,
    );
  }
  if (profile.deepest) {
    lines.push(
      `- Deepest point: depth ${profile.deepest.value} at ${pointerLabel(profile.deepest.pointer)}`,
    );
  }
  return lines;
}

function shapeLines(shapes: ArrayShapeReport[]): string[] {
  const lines: string[] = [];
  for (const report of shapes) {
    if (report.variants.length <= 1 && report.typeVariances.length === 0) continue;
    lines.push(`### Array at ${pointerLabel(report.pointer)}`);
    lines.push('');
    lines.push(
      `- ${formatInt(report.objectCount)} objects, ${report.variants.length} distinct ${report.variants.length === 1 ? 'shape' : 'shapes'}, ${formatPercent(report.conformity)} share the dominant shape`,
    );
    for (const variant of report.variants) {
      const tag = variant.dominant ? 'dominant' : 'variant';
      const diffs: string[] = [];
      if (variant.missing.length > 0) diffs.push(`missing ${variant.missing.join(', ')}`);
      if (variant.extra.length > 0) diffs.push(`extra ${variant.extra.join(', ')}`);
      lines.push(
        `  - ${tag} ×${variant.count}: {${variant.keys.join(', ')}}${diffs.length ? ` — ${diffs.join('; ')}` : ''}`,
      );
    }
    for (const tv of report.typeVariances) {
      const offender = tv.offenders[0]!;
      lines.push(
        `  - field ${JSON.stringify(tv.key)}: ${tv.dominantKind} in ${tv.dominantCount}/${tv.present}, ${offender.kind} at ${offender.pointer}`,
      );
    }
    lines.push('');
  }
  return lines;
}

function pointerLabel(pointer: string): string {
  return pointer === '' ? '(root)' : pointer;
}

/** Render the analysis as a Markdown diagnostic report (no source embedded). */
export function toMarkdownReport(analysis: JsonAnalysis): string {
  const lines: string[] = ['# JSON Crime Scene report', ''];
  const fileName = analysis.meta.fileName;

  if (analysis.status !== 'ok') {
    lines.push(statusNote(analysis));
    lines.push('');
    return lines.join('\n').trimEnd() + '\n';
  }

  lines.push(
    `Local diagnostic report${fileName ? ` for \`${fileName}\`` : ''}. Generated in the browser — the JSON was never uploaded, and its source is not included here.`,
  );
  lines.push('');
  lines.push('## Overview');
  lines.push('');
  lines.push(...overviewLines(analysis.profile, fileName));
  lines.push('');

  lines.push('## Findings');
  lines.push('');
  if (analysis.findings.length === 0) {
    lines.push('No structural findings — nothing unusual surfaced.');
    lines.push('');
  } else {
    for (const finding of analysis.findings) lines.push(...findingBlock(finding));
  }

  const highlights = highlightLines(analysis.profile);
  if (highlights.length > 0) {
    lines.push('## Structure highlights');
    lines.push('');
    lines.push(...highlights);
    lines.push('');
  }

  const shapes = shapeLines(analysis.shapes);
  if (shapes.length > 0) {
    lines.push('## Object-shape observations');
    lines.push('');
    lines.push(...shapes);
  }

  return lines.join('\n').trimEnd() + '\n';
}

/** Render the analysis as a compact JSON diagnostic report (no source embedded). */
export function toJsonReport(analysis: JsonAnalysis): string {
  if (analysis.status !== 'ok') {
    return JSON.stringify(
      { tool: 'JSON Crime Scene', status: analysis.status, note: statusNote(analysis) },
      null,
      2,
    );
  }

  const payload = {
    tool: 'JSON Crime Scene',
    note: 'Diagnostic report only — the original JSON source is not included.',
    file: analysis.meta.fileName,
    overview: analysis.profile,
    findings: analysis.findings.map((f) => ({
      severity: f.severity,
      category: f.category,
      title: f.title,
      detail: f.detail,
      why: f.why,
      pointer: f.pointer,
      count: f.count,
      examples: f.examples,
      examplesTruncated: f.examplesTruncated,
    })),
    shapes: analysis.shapes
      .filter((r) => r.variants.length > 1 || r.typeVariances.length > 0)
      .map((r) => ({
        pointer: r.pointer,
        objectCount: r.objectCount,
        conformity: r.conformity,
        variants: r.variants,
        typeVariances: r.typeVariances,
        nullability: r.nullability,
      })),
  };
  return JSON.stringify(payload, null, 2);
}
