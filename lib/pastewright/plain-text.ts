/**
 * Block rendering for the plain-text destination family (LinkedIn, Slack, Plain).
 *
 * The routine is policy-driven: the shared structure lives here, and the small
 * per-destination differences (blockquote style, code fencing, tables-in-a-code-
 * block) come from the `PlainPolicy`. Output keeps the document's information
 * architecture — headings stay separated, lists stay lists, quotes stay quoted,
 * code stays verbatim, tables stay readable — while removing markup the target
 * can't honour.
 */

import type { Root, RootContent, Heading, List, ListItem, Blockquote, Code, Table } from 'mdast';
import type { Destination, RenderStats, TableLayout } from './types';
import type { PlainPolicy } from './profiles';
import { renderInline, type InlineCtx } from './inline';
import { extractTable, renderAligned, renderRecords, resolveLayout } from './tables';
import { displayWidth } from './width';
import { joinBlocks, trimBlankEdges, indentLines, type DefMap } from './util';

export interface PlainCtx extends InlineCtx {
  destination: Destination;
  tableLayout: TableLayout;
}

const UNDERLINE_CAP = 72;

/** Render a whole document to plain text for the given destination policy. */
export function renderPlain(
  root: Root,
  destination: Destination,
  policy: PlainPolicy,
  tableLayout: TableLayout,
  stats: RenderStats,
  defs: DefMap,
): string {
  const ctx: PlainCtx = { policy, stats, defs, destination, tableLayout };
  const blocks = root.children.map((node) => renderBlock(node, ctx));
  return trimBlankEdges(joinBlocks(blocks));
}

function renderBlocks(nodes: readonly RootContent[], ctx: PlainCtx, sep: string): string {
  return nodes
    .map((n) => renderBlock(n, ctx))
    .filter((b) => b !== '')
    .join(sep);
}

function renderBlock(node: RootContent, ctx: PlainCtx): string {
  switch (node.type) {
    case 'heading':
      return renderHeading(node, ctx);
    case 'paragraph':
      return renderInline(node.children, ctx);
    case 'list':
      return renderList(node, ctx);
    case 'blockquote':
      return renderBlockquote(node, ctx);
    case 'code':
      return renderCode(node, ctx);
    case 'thematicBreak':
      ctx.stats.thematicBreaks += 1;
      return ctx.policy.hr;
    case 'table':
      return renderTable(node, ctx);
    case 'html':
      // Raw HTML block: the author's literal text, never interpreted.
      ctx.stats.html += 1;
      return node.value;
    case 'definition':
      // Reference definitions are metadata; their targets render at the reference.
      return '';
    default: {
      const anyNode = node as { children?: RootContent[]; value?: string };
      if (Array.isArray(anyNode.children)) return renderBlocks(anyNode.children, ctx, '\n\n');
      return typeof anyNode.value === 'string' ? anyNode.value : '';
    }
  }
}

function renderHeading(node: Heading, ctx: PlainCtx): string {
  ctx.stats.headings += 1;
  const text = renderInline(node.children, ctx);
  if (text.trim() === '') return '';
  // On proportional surfaces (LinkedIn) a box-drawing underline renders as a
  // mis-sized bar, so the heading is a plain section label separated by spacing.
  if (!ctx.policy.headingUnderline) return text;
  const width = Math.min(displayWidth(text.replace(/\n/g, ' ')), UNDERLINE_CAP);
  if (node.depth === 1) return `${text}\n${'═'.repeat(Math.max(width, 1))}`;
  if (node.depth === 2) return `${text}\n${'─'.repeat(Math.max(width, 1))}`;
  return text;
}

function renderList(node: List, ctx: PlainCtx): string {
  ctx.stats.lists += 1;
  const ordered = node.ordered ?? false;
  const start = node.start ?? 1;
  const itemSep = node.spread ? '\n\n' : '\n';

  const items = node.children.map((item, index) => {
    const marker = itemMarker(item, ordered, start + index, ctx);
    const indent = ' '.repeat(displayWidth(marker));
    const content = renderItemContent(item, ctx);
    // An empty item is just its marker — trimmed, so it carries no trailing space.
    return content === '' ? marker.trimEnd() : indentLines(content, marker, indent);
  });

  return items.filter((b) => b.trim() !== '').join(itemSep);
}

function itemMarker(item: ListItem, ordered: boolean, n: number, ctx: PlainCtx): string {
  if (typeof item.checked === 'boolean') {
    ctx.stats.taskItems += 1;
    ctx.stats.taskItemsAdapted += 1;
    return `${item.checked ? ctx.policy.task.checked : ctx.policy.task.unchecked} `;
  }
  return ordered ? `${n}. ` : `${ctx.policy.bullet} `;
}

function renderItemContent(item: ListItem, ctx: PlainCtx): string {
  const sep = item.spread ? '\n\n' : '\n';
  return renderBlocks(item.children, ctx, sep);
}

function renderBlockquote(node: Blockquote, ctx: PlainCtx): string {
  ctx.stats.blockquotes += 1;
  const inner = renderBlocks(node.children, ctx, '\n\n');
  if (ctx.policy.blockquote === 'wrap') {
    return `“${inner}”`;
  }
  const prefix = ctx.policy.quotePrefix;
  return inner
    .split('\n')
    .map((line) => (line === '' ? prefix.trimEnd() : prefix + line))
    .join('\n');
}

function renderCode(node: Code, ctx: PlainCtx): string {
  ctx.stats.codeBlocks += 1;
  const value = node.value ?? '';
  if (ctx.policy.codeBlock === 'fence') {
    return `\`\`\`\n${value}\n\`\`\``;
  }
  return value;
}

function renderTable(node: Table, ctx: PlainCtx): string {
  const model = extractTable(node, ctx);
  // A header-only table has no rows to make records from; the bordered header
  // is the faithful representation (and never drops the header cells).
  const layout =
    model.rows.length === 0 ? 'aligned' : resolveLayout(model, ctx.destination, ctx.tableLayout);
  let text: string;
  let representation: 'aligned' | 'records';
  if (layout === 'records') {
    text = renderRecords(model);
    representation = 'records';
  } else {
    // `aligned` (compact) and `wrapped` (wide) share the bordered renderer; it
    // wraps cells only when they don't fit the bounded target width.
    const aligned = renderAligned(model);
    text = ctx.policy.tableInCodeFence ? `\`\`\`\n${aligned}\n\`\`\`` : aligned;
    representation = 'aligned';
  }
  ctx.stats.tables.push({
    columns: model.columns,
    rows: model.rows.length,
    representation,
  });
  return text;
}
