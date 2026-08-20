/**
 * The transformation report — Pastewright's second flagship.
 *
 * It doesn't just hand back adapted text; it says, in plain language, what it did
 * and why. Findings are aggregated (one note per class of construct, never one per
 * bold word), tagged with an honest impact, and turned into a compact status.
 * Ordinary destination adaptation is described as an adjustment, never an error.
 */

import type {
  Destination,
  Finding,
  FindingImpact,
  RenderStats,
  TableStat,
  TransformStatus,
} from './types';
import { isPlainDestination } from './profiles';

function s(n: number): string {
  return n === 1 ? '' : 's';
}

function emphasisParts(stats: RenderStats): string {
  const parts: string[] = [];
  if (stats.strong) parts.push(`${stats.strong} bold`);
  if (stats.emphasis) parts.push(`${stats.emphasis} italic`);
  if (stats.strike) parts.push(`${stats.strike} strikethrough`);
  return parts.join(', ');
}

function describeTables(destination: Destination, tables: TableStat[]): string {
  const n = tables.length;
  if (destination === 'rich') {
    return `${n} Markdown table${s(n)} will be copied as ${n === 1 ? 'an HTML table' : 'HTML tables'}.`;
  }
  if (destination === 'reddit') {
    return `${n} table${s(n)} kept as Markdown pipe table${s(n)} (Reddit Markdown mode / new Reddit).`;
  }
  const records = tables.filter((t) => t.representation === 'records');
  const aligned = tables.filter((t) => t.representation === 'aligned');
  const fence = destination === 'slack' ? ' in a code block' : '';
  if (n === 1) {
    const t = tables[0]!;
    if (t.representation === 'records') {
      return `One ${t.columns}-column Markdown table became ${t.rows} record block${s(t.rows)}.`;
    }
    return `One ${t.columns}-column Markdown table was laid out as aligned columns${fence}.`;
  }
  const segs: string[] = [];
  if (records.length) segs.push(`${records.length} as record block${s(records.length)}`);
  if (aligned.length) segs.push(`${aligned.length} as aligned columns${fence}`);
  return `${n} tables adapted (${segs.join(', ')}).`;
}

/** Build the aggregated, ordered findings for a destination from render stats. */
export function buildFindings(destination: Destination, stats: RenderStats): Finding[] {
  const findings: Finding[] = [];
  const plain = isPlainDestination(destination);
  const push = (
    category: Finding['category'],
    impact: FindingImpact,
    title: string,
    detail: string,
    count: number,
  ): void => {
    findings.push({ id: `${category}-${impact}`, category, impact, title, detail, count });
  };

  // Tables — the flagship, always reported when present.
  if (stats.tables.length > 0) {
    const n = stats.tables.length;
    const impact: FindingImpact =
      destination === 'rich' || destination === 'reddit' ? 'preserved' : 'adapted';
    const title =
      destination === 'rich'
        ? 'Rich table preserved'
        : destination === 'reddit'
          ? 'Tables kept as Markdown'
          : 'Table adapted';
    push('tables', impact, title, describeTables(destination, stats.tables), n);
  }

  // Headings.
  if (stats.headings > 0) {
    if (plain) {
      push(
        'headings',
        'adapted',
        'Headings adapted',
        `${stats.headings} Markdown heading${s(stats.headings)} became plain-text section heading${s(stats.headings)}.`,
        stats.headings,
      );
    } else {
      push(
        'headings',
        'preserved',
        'Headings preserved',
        `${stats.headings} Markdown heading${s(stats.headings)} kept as ${destination === 'rich' ? 'HTML heading levels' : 'Markdown headings'}.`,
        stats.headings,
      );
    }
  }

  // Emphasis (bold / italic / strikethrough).
  const emphasisCount = stats.strong + stats.emphasis + stats.strike;
  if (emphasisCount > 0) {
    if (stats.emphasisStripped) {
      push(
        'emphasis',
        'compromised',
        'Formatting removed',
        `${emphasisParts(stats)} span${s(emphasisCount)} can't be shown in this destination; the text was kept without emphasis.`,
        emphasisCount,
      );
    } else {
      push(
        'emphasis',
        'preserved',
        'Emphasis preserved',
        `${emphasisParts(stats)} span${s(emphasisCount)} kept as ${destination === 'rich' ? 'HTML formatting' : 'Markdown'}.`,
        emphasisCount,
      );
    }
  }

  // Links.
  if (stats.links > 0) {
    if (plain) {
      // Some links are shown as "label + URL"; autolinks (or links whose label
      // already is the URL) appear as a bare URL. Word it from what actually happened.
      const expanded = stats.linksExpanded;
      const detail =
        expanded === stats.links
          ? `${stats.links} link${s(stats.links)} shown as label + URL.`
          : expanded === 0
            ? `${stats.links} link${s(stats.links)} shown as ${stats.links === 1 ? 'its' : 'their'} URL.`
            : `${stats.links} links shown with their URL (${expanded} as label + URL).`;
      push('links', 'adapted', 'Links expanded', detail, stats.links);
    } else {
      push(
        'links',
        'preserved',
        'Links preserved',
        `${stats.links} link${s(stats.links)} kept ${destination === 'rich' ? 'clickable' : 'as Markdown links'}.`,
        stats.links,
      );
    }
  }

  // Images.
  if (stats.images > 0) {
    const detail =
      destination === 'rich'
        ? `${stats.images} image${s(stats.images)} represented as link${s(stats.images)} — remote images are never fetched or embedded.`
        : destination === 'reddit'
          ? `${stats.images} image${s(stats.images)} became link${s(stats.images)} — Reddit doesn't embed images in text posts.`
          : `${stats.images} image${s(stats.images)} became alt text + URL.`;
    push('images', 'adapted', 'Images adapted', detail, stats.images);
  }

  // Code (fenced blocks + inline spans).
  const codeCount = stats.codeBlocks + stats.inlineCode;
  if (codeCount > 0) {
    if (destination === 'rich') {
      push(
        'code',
        'preserved',
        'Code preserved',
        `${codeCount} code block${s(codeCount)}/span${s(codeCount)} kept as HTML code.`,
        codeCount,
      );
    } else if (destination === 'reddit') {
      push(
        'code',
        'preserved',
        'Code kept',
        `${codeCount} code block${s(codeCount)}/span${s(codeCount)} preserved as Markdown.`,
        codeCount,
      );
    } else if (destination === 'slack') {
      push(
        'code',
        'adapted',
        'Code fenced for Slack',
        `${codeCount} code block${s(codeCount)}/span${s(codeCount)} wrapped in backticks.`,
        codeCount,
      );
    } else {
      push(
        'code',
        'adapted',
        'Code kept as text',
        `${codeCount} code block${s(codeCount)}/span${s(codeCount)} preserved verbatim as text.`,
        codeCount,
      );
    }
  }

  // Blockquotes.
  if (stats.blockquotes > 0) {
    if (plain) {
      push(
        'blockquotes',
        'adapted',
        'Blockquotes adapted',
        `${stats.blockquotes} blockquote${s(stats.blockquotes)} shown as quoted text.`,
        stats.blockquotes,
      );
    } else {
      push(
        'blockquotes',
        'preserved',
        'Blockquotes preserved',
        `${stats.blockquotes} blockquote${s(stats.blockquotes)} kept.`,
        stats.blockquotes,
      );
    }
  }

  // Task lists (no native checkboxes anywhere Pastewright targets).
  if (stats.taskItemsAdapted > 0) {
    push(
      'lists',
      'adapted',
      'Task list adapted',
      `${stats.taskItemsAdapted} task item${s(stats.taskItemsAdapted)} shown with ☑ / ☐ boxes.`,
      stats.taskItemsAdapted,
    );
  }

  // Horizontal rules — a plain-text separator replaces the Markdown rule; rich and
  // Reddit keep it (<hr> / ---), so it's only an adaptation for the plain family.
  if (stats.thematicBreaks > 0 && plain) {
    push(
      'rules',
      'adapted',
      'Horizontal rules adapted',
      `${stats.thematicBreaks} horizontal rule${s(stats.thematicBreaks)} shown as a text separator.`,
      stats.thematicBreaks,
    );
  }

  // Raw HTML — literal text everywhere, never rendered.
  if (stats.html > 0) {
    push(
      'html',
      'compromised',
      'Raw HTML kept as text',
      `${stats.html} raw HTML fragment${s(stats.html)} shown as literal text, not rendered.`,
      stats.html,
    );
  }

  return findings;
}

/** Derive the compact status badge from the findings. */
export function statusFromFindings(findings: Finding[]): TransformStatus {
  const compromised = findings.filter((f) => f.impact === 'compromised');
  const adapted = findings.filter((f) => f.impact === 'adapted');

  if (compromised.length > 0) {
    return {
      kind: 'compromised',
      label: 'Formatting compromises',
      summary: `${compromised.length} source feature${s(compromised.length)} ${compromised.length === 1 ? 'has' : 'have'} no direct representation here; the text was kept in full.`,
    };
  }
  if (adapted.length > 0) {
    return {
      kind: 'adapted',
      label: 'Adapted',
      summary: `${adapted.length} destination-specific adjustment${s(adapted.length)}.`,
    };
  }
  return {
    kind: 'preserved',
    label: 'Preserved',
    summary: 'This document can be represented without structural loss.',
  };
}
