/**
 * Inline (phrasing) rendering for the plain-text destination family.
 *
 * This turns a run of inline nodes into readable plain text while recording, in
 * `RenderStats`, what it had to adapt. It never invents words: emphasis markup is
 * removed but its text is kept; a link becomes "label (url)"; an image becomes
 * "alt (url)"; inline code keeps its backticks; raw inline HTML is passed through
 * as the author's literal text.
 *
 * The same routine renders table-cell text, so cells come out clean and
 * single-lineable.
 */

import type { PhrasingContent } from 'mdast';
import type { RenderStats } from './types';
import type { PlainPolicy } from './profiles';
import type { DefMap } from './util';

export interface InlineCtx {
  policy: PlainPolicy;
  stats: RenderStats;
  defs: DefMap;
}

/** Format a link as a readable "label (url)", avoiding duplication. */
function formatLink(label: string, url: string, stats: RenderStats): string {
  const trimmedLabel = label.trim();
  const trimmedUrl = url.trim();
  if (trimmedUrl === '') return trimmedLabel;
  if (trimmedLabel === '' || trimmedLabel === trimmedUrl) return trimmedUrl;
  stats.linksExpanded += 1;
  return `${label} (${trimmedUrl})`;
}

/** Format an image as "alt (url)", or just the url when there is no alt text. */
function formatImage(alt: string, url: string, stats: RenderStats): string {
  const trimmedAlt = alt.trim();
  const trimmedUrl = url.trim();
  stats.images += 1;
  if (trimmedUrl === '') return trimmedAlt;
  if (trimmedAlt === '' || trimmedAlt === trimmedUrl) return trimmedUrl;
  return `${alt} (${trimmedUrl})`;
}

export function renderInline(nodes: readonly PhrasingContent[], ctx: InlineCtx): string {
  let out = '';
  for (const node of nodes) {
    out += renderInlineNode(node, ctx);
  }
  return out;
}

function renderInlineNode(node: PhrasingContent, ctx: InlineCtx): string {
  const { stats } = ctx;
  switch (node.type) {
    case 'text':
      return node.value;
    case 'inlineCode':
      stats.inlineCode += 1;
      return `\`${node.value}\``;
    case 'strong':
      stats.strong += 1;
      stats.emphasisStripped = true;
      return renderInline(node.children, ctx);
    case 'emphasis':
      stats.emphasis += 1;
      stats.emphasisStripped = true;
      return renderInline(node.children, ctx);
    case 'delete':
      stats.strike += 1;
      stats.emphasisStripped = true;
      return renderInline(node.children, ctx);
    case 'break':
      return '\n';
    case 'link': {
      stats.links += 1;
      const label = renderInline(node.children, ctx);
      return formatLink(label, node.url, stats);
    }
    case 'linkReference': {
      stats.links += 1;
      const label = renderInline(node.children, ctx);
      const def = ctx.defs.get(node.identifier);
      if (def) return formatLink(label, def.url, stats);
      // Unresolved reference — keep the label text; no URL to expose.
      return label;
    }
    case 'image':
      return formatImage(node.alt ?? '', node.url, ctx.stats);
    case 'imageReference': {
      const def = ctx.defs.get(node.identifier);
      if (def) return formatImage(node.alt ?? '', def.url, ctx.stats);
      stats.images += 1;
      return node.alt ?? '';
    }
    case 'html':
      // Raw inline HTML is the author's literal text; never interpreted.
      stats.html += 1;
      return node.value;
    case 'footnoteReference':
      return `[^${node.identifier}]`;
    default: {
      // Any node we don't special-case: preserve its text content losslessly.
      const anyNode = node as { children?: PhrasingContent[]; value?: string };
      if (Array.isArray(anyNode.children)) return renderInline(anyNode.children, ctx);
      return typeof anyNode.value === 'string' ? anyNode.value : '';
    }
  }
}
