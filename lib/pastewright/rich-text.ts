/**
 * Rich (HTML) rendering.
 *
 * The Rich text destination builds a small, controlled `RichNode` tree from the
 * parsed Markdown — never from source HTML. That tree is the single source of
 * truth for both the `text/html` clipboard payload and the React preview, so the
 * two can never drift. Text is escaped only at serialisation time; raw source
 * HTML is carried as literal text, so there is no path from source Markdown to
 * executable markup, and no `dangerouslySetInnerHTML` of untrusted content.
 *
 * Generated HTML is deliberately plain and paste-friendly: semantic tags, one
 * inline `text-align` on table cells, safe `href`s only — no scripts, no event
 * handlers, no external stylesheets, no giant inline CSS.
 */

import type {
  Root,
  RootContent,
  PhrasingContent,
  Heading,
  List,
  ListItem,
  Table,
  TableRow,
  Code,
} from 'mdast';
import type { RichNode, RichTag, RichAttrs, RenderStats } from './types';
import { escapeHtml, escapeHtmlAttr, sanitizeUrl, type DefMap } from './util';

interface RichCtx {
  stats: RenderStats;
  defs: DefMap;
}

const VOID_TAGS = new Set<RichTag>(['br', 'hr']);

function el(tag: RichTag, children: RichNode[], attrs?: RichAttrs): RichNode {
  return attrs ? { kind: 'element', tag, attrs, children } : { kind: 'element', tag, children };
}
function txt(value: string): RichNode {
  return { kind: 'text', value };
}

// ── Inline ───────────────────────────────────────────────────────────────────

function richInline(nodes: readonly PhrasingContent[], ctx: RichCtx): RichNode[] {
  const out: RichNode[] = [];
  for (const node of nodes) out.push(...richInlineNode(node, ctx));
  return out;
}

function anchorOrText(label: RichNode[], url: string, ctx: RichCtx): RichNode[] {
  const safe = sanitizeUrl(url);
  if (safe) {
    ctx.stats.links += 1;
    return [el('a', label.length ? label : [txt(url)], { href: safe })];
  }
  // Unsafe scheme: keep the label as inert text, never an active link.
  ctx.stats.links += 1;
  return label.length ? label : [txt(url)];
}

function richInlineNode(node: PhrasingContent, ctx: RichCtx): RichNode[] {
  const { stats } = ctx;
  switch (node.type) {
    case 'text':
      return [txt(node.value)];
    case 'inlineCode':
      stats.inlineCode += 1;
      return [el('code', [txt(node.value)])];
    case 'strong':
      stats.strong += 1;
      return [el('strong', richInline(node.children, ctx))];
    case 'emphasis':
      stats.emphasis += 1;
      return [el('em', richInline(node.children, ctx))];
    case 'delete':
      stats.strike += 1;
      return [el('del', richInline(node.children, ctx))];
    case 'break':
      return [el('br', [])];
    case 'link':
      return anchorOrText(richInline(node.children, ctx), node.url, ctx);
    case 'linkReference': {
      const def = ctx.defs.get(node.identifier);
      const label = richInline(node.children, ctx);
      return def ? anchorOrText(label, def.url, ctx) : label;
    }
    case 'image': {
      stats.images += 1;
      const alt = node.alt ?? '';
      const safe = sanitizeUrl(node.url);
      // Images are represented as a labelled link, never fetched or embedded.
      if (safe) return [el('a', [txt(alt || node.url)], { href: safe })];
      return [txt(alt || node.url)];
    }
    case 'imageReference': {
      stats.images += 1;
      const def = ctx.defs.get(node.identifier);
      const alt = node.alt ?? '';
      if (def) {
        const safe = sanitizeUrl(def.url);
        if (safe) return [el('a', [txt(alt || def.url)], { href: safe })];
      }
      return [txt(alt)];
    }
    case 'html':
      stats.html += 1;
      return [txt(node.value)]; // literal text, escaped on serialize
    case 'footnoteReference':
      return [txt(`[^${node.identifier}]`)];
    default: {
      const anyNode = node as { children?: PhrasingContent[]; value?: string };
      if (Array.isArray(anyNode.children)) return richInline(anyNode.children, ctx);
      return typeof anyNode.value === 'string' ? [txt(anyNode.value)] : [];
    }
  }
}

// ── Blocks ───────────────────────────────────────────────────────────────────

function richBlocks(nodes: readonly RootContent[], ctx: RichCtx): RichNode[] {
  const out: RichNode[] = [];
  for (const node of nodes) {
    const rendered = richBlock(node, ctx);
    if (rendered) out.push(rendered);
  }
  return out;
}

function richBlock(node: RootContent, ctx: RichCtx): RichNode | null {
  switch (node.type) {
    case 'heading':
      return richHeading(node, ctx);
    case 'paragraph':
      return el('p', richInline(node.children, ctx));
    case 'list':
      return richList(node, ctx);
    case 'blockquote':
      ctx.stats.blockquotes += 1;
      return el('blockquote', richBlocks(node.children, ctx));
    case 'code':
      return richCode(node, ctx);
    case 'thematicBreak':
      ctx.stats.thematicBreaks += 1;
      return el('hr', []);
    case 'table':
      return richTable(node, ctx);
    case 'html':
      ctx.stats.html += 1;
      return el('p', [txt(node.value)]);
    case 'definition':
      return null;
    default: {
      const anyNode = node as { children?: RootContent[]; value?: string };
      if (Array.isArray(anyNode.children)) {
        const kids = richBlocks(anyNode.children, ctx);
        return kids.length ? el('p', kids) : null;
      }
      return typeof anyNode.value === 'string' ? el('p', [txt(anyNode.value)]) : null;
    }
  }
}

function richHeading(node: Heading, ctx: RichCtx): RichNode {
  ctx.stats.headings += 1;
  const depth = Math.min(Math.max(node.depth, 1), 6);
  const tag = `h${depth}` as RichTag;
  return el(tag, richInline(node.children, ctx));
}

function richList(node: List, ctx: RichCtx): RichNode {
  ctx.stats.lists += 1;
  const ordered = node.ordered ?? false;
  const tag: RichTag = ordered ? 'ol' : 'ul';
  const attrs: RichAttrs | undefined =
    ordered && typeof node.start === 'number' && node.start !== 1
      ? { start: node.start }
      : undefined;
  const items = node.children.map((item) => richListItem(item, ctx));
  return el(tag, items, attrs);
}

function richListItem(item: ListItem, ctx: RichCtx): RichNode {
  const children: RichNode[] = [];
  if (typeof item.checked === 'boolean') {
    ctx.stats.taskItems += 1;
    ctx.stats.taskItemsAdapted += 1;
    children.push(txt(item.checked ? '☑ ' : '☐ '));
  }
  const tight = !item.spread;
  for (const child of item.children) {
    if (tight && child.type === 'paragraph') {
      // Unwrap the single paragraph so tight items don't gain block spacing.
      children.push(...richInline(child.children, ctx));
    } else {
      const rendered = richBlock(child, ctx);
      if (rendered) children.push(rendered);
    }
  }
  return el('li', children);
}

function richCode(node: Code, ctx: RichCtx): RichNode {
  ctx.stats.codeBlocks += 1;
  return el('pre', [el('code', [txt(node.value ?? '')])]);
}

function richTable(node: Table, ctx: RichCtx): RichNode {
  const align = node.align ?? [];
  const rows = node.children;
  const columns = Math.max(align.length, ...rows.map((r) => r.children.length), 1);

  const renderRow = (row: TableRow, cellTag: 'th' | 'td'): RichNode => {
    const cells: RichNode[] = [];
    for (let c = 0; c < columns; c += 1) {
      const cell = row.children[c];
      const a = align[c] ?? null;
      const attrs: RichAttrs | undefined = a ? { align: a } : undefined;
      cells.push(el(cellTag, cell ? richInline(cell.children, ctx) : [], attrs));
    }
    return el('tr', cells);
  };

  const headerRow = rows[0];
  const bodyRows = rows.slice(1);
  const thead = headerRow ? [el('thead', [renderRow(headerRow, 'th')])] : [];
  const tbody = bodyRows.length
    ? [
        el(
          'tbody',
          bodyRows.map((r) => renderRow(r, 'td')),
        ),
      ]
    : [];

  ctx.stats.tables.push({ columns, rows: bodyRows.length, representation: 'html' });
  return el('table', [...thead, ...tbody]);
}

// ── Serialisation ────────────────────────────────────────────────────────────

function serializeAttrs(attrs: RichAttrs | undefined): string {
  if (!attrs) return '';
  let out = '';
  if (attrs.href !== undefined) out += ` href="${escapeHtmlAttr(attrs.href)}"`;
  if (attrs.start !== undefined) out += ` start="${attrs.start}"`;
  if (attrs.align !== undefined) out += ` style="text-align:${attrs.align}"`;
  return out;
}

function serializeNode(node: RichNode): string {
  if (node.kind === 'text') return escapeHtml(node.value);
  const { tag, attrs, children } = node;
  const open = `<${tag}${serializeAttrs(attrs)}>`;
  if (VOID_TAGS.has(tag)) return `<${tag}${serializeAttrs(attrs)} />`;
  return `${open}${children.map(serializeNode).join('')}</${tag}>`;
}

/** Serialise a controlled node tree to an HTML string (all text escaped). */
export function serializeRich(nodes: RichNode[]): string {
  return nodes.map(serializeNode).join('\n');
}

/** Build the Rich text node tree from a document, tallying findings as it goes. */
export function renderRich(root: Root, stats: RenderStats, defs: DefMap): RichNode[] {
  return richBlocks(root.children, { stats, defs });
}
