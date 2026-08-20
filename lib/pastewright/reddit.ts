/**
 * Reddit Markdown rendering.
 *
 * Reddit's Markdown editing mode (new Reddit) understands most of GFM — headings,
 * emphasis, strikethrough, lists, blockquotes, links, inline and fenced code, and
 * pipe tables — so this destination *keeps* Markdown and adapts only what Reddit
 * can't reliably show:
 *
 *   - Images don't embed in a text post, so `![alt](url)` (inline or reference
 *     style) becomes `[alt](url)`; an image used as link text collapses to the
 *     link so no invalid nested-link Markdown is produced.
 *   - Task-list checkboxes aren't supported, so items become box-glyph bullets.
 *
 * The tree is deep-cloned before adaptation, so the shared parse is untouched, and
 * re-serialised with the maintained `mdast-util-to-markdown` GFM serialiser rather
 * than any hand-rolled Markdown writer.
 */

import { toMarkdown } from 'mdast-util-to-markdown';
import { gfmToMarkdown } from 'mdast-util-gfm';
import type { Root, RootContent, ListItem, Paragraph, Link, Text } from 'mdast';
import type { RenderStats } from './types';
import { collectDefinitions, trimBlankEdges, type DefMap } from './util';

const CHECKED_GLYPH = '☑ ';
const UNCHECKED_GLYPH = '☐ ';

interface RedditCtx {
  stats: RenderStats;
  defs: DefMap;
  /** True while adapting the children of a link — images become plain text there. */
  inLink: boolean;
}

function textNode(value: string): Text {
  return { type: 'text', value };
}

function imageToLink(url: string, title: string | null | undefined, alt: string): Link {
  const children: Text[] = alt ? [textNode(alt)] : [];
  return { type: 'link', url, title: title ?? null, children };
}

function adaptChildren(nodes: RootContent[] | undefined, ctx: RedditCtx): void {
  if (!Array.isArray(nodes)) return;
  for (let i = 0; i < nodes.length; i += 1) {
    nodes[i] = adaptNode(nodes[i]!, ctx);
  }
}

function adaptTaskItem(item: ListItem, ctx: RedditCtx): ListItem {
  ctx.stats.taskItems += 1;
  ctx.stats.taskItemsAdapted += 1;
  const glyph = item.checked === true ? CHECKED_GLYPH : UNCHECKED_GLYPH;
  item.checked = null;
  adaptChildren(item.children as RootContent[], ctx);
  const first = item.children[0];
  if (first && first.type === 'paragraph') {
    (first as Paragraph).children.unshift(textNode(glyph));
  } else {
    item.children.unshift({ type: 'paragraph', children: [textNode(glyph)] });
  }
  return item;
}

function adaptNode(node: RootContent, ctx: RedditCtx): RootContent {
  const { stats } = ctx;
  switch (node.type) {
    case 'image': {
      stats.images += 1;
      // Inside a link, an image becomes plain alt text (no nested link);
      // otherwise it becomes a standalone link.
      return ctx.inLink
        ? textNode(node.alt ?? '')
        : imageToLink(node.url, node.title, node.alt ?? '');
    }
    case 'imageReference': {
      stats.images += 1;
      const def = ctx.defs.get(node.identifier);
      const alt = node.alt ?? '';
      if (ctx.inLink || !def) return textNode(alt);
      return imageToLink(def.url, def.title, alt);
    }
    case 'listItem':
      if (typeof node.checked === 'boolean') return adaptTaskItem(node, ctx);
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'heading':
      stats.headings += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'strong':
      stats.strong += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'emphasis':
      stats.emphasis += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'delete':
      stats.strike += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'inlineCode':
      stats.inlineCode += 1;
      return node;
    case 'code':
      stats.codeBlocks += 1;
      return node;
    case 'link':
    case 'linkReference':
      stats.links += 1;
      adaptChildren(node.children as RootContent[], { ...ctx, inLink: true });
      return node;
    case 'blockquote':
      stats.blockquotes += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'list':
      stats.lists += 1;
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    case 'thematicBreak':
      stats.thematicBreaks += 1;
      return node;
    case 'html':
      stats.html += 1;
      return node;
    case 'table': {
      const rows = node.children;
      const columns = Math.max(node.align?.length ?? 0, ...rows.map((r) => r.children.length), 1);
      stats.tables.push({ columns, rows: Math.max(0, rows.length - 1), representation: 'pipe' });
      adaptChildren(node.children as RootContent[], ctx);
      return node;
    }
    default:
      adaptChildren((node as { children?: RootContent[] }).children, ctx);
      return node;
  }
}

/** Render a document to Reddit-flavoured Markdown, tallying adaptations. */
export function renderReddit(root: Root, stats: RenderStats): string {
  const tree = structuredClone(root) as Root;
  const ctx: RedditCtx = { stats, defs: collectDefinitions(tree), inLink: false };
  adaptChildren(tree.children as RootContent[], ctx);
  const out = toMarkdown(tree, {
    extensions: [gfmToMarkdown()],
    bullet: '-',
    fences: true,
  });
  return trimBlankEdges(out);
}
