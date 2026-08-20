/**
 * Small shared helpers: HTML escaping, URL scheme-checking, reference-definition
 * collection, and block joining with deterministic spacing.
 */

import type { Root, RootContent, PhrasingContent } from 'mdast';

/** Resolved link/image reference definitions, keyed by normalised identifier. */
export type DefMap = Map<string, { url: string; title?: string | null }>;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape text for safe placement in HTML element content. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/** Escape a value for safe placement inside a double-quoted HTML attribute. */
export function escapeHtmlAttr(text: string): string {
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]!);
}

/**
 * Strip C0/C1 control characters (0x00–0x1F, 0x7F–0x9F). Written as a code-point
 * scan rather than a control-character regex literal so the source stays plain
 * ASCII and reviewable.
 */
function stripControlChars(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x00 && cp <= 0x1f) || (cp >= 0x7f && cp <= 0x9f)) continue;
    out += ch;
  }
  return out;
}

/**
 * Return `url` if it uses a safe scheme (or is relative), else `null`. Blocks
 * `javascript:`, `data:`, `vbscript:`, `file:` and anything else that could turn
 * a generated anchor into an execution or exfiltration vector. Control
 * characters (including ones smuggled mid-scheme) are removed before the check.
 */
export function sanitizeUrl(url: string): string | null {
  const cleaned = stripControlChars(url).trim();
  if (cleaned === '') return null;
  const match = /^([a-z][a-z0-9+.-]*):/i.exec(cleaned);
  if (!match) return cleaned; // relative, anchor, or protocol-relative — safe
  const scheme = match[1]!.toLowerCase();
  if (scheme === 'http' || scheme === 'https' || scheme === 'mailto' || scheme === 'tel') {
    return cleaned;
  }
  return null;
}

/** Collect all reference-definition nodes into a lookup map. */
export function collectDefinitions(root: Root): DefMap {
  const defs: DefMap = new Map();
  const walk = (nodes: readonly RootContent[] | readonly PhrasingContent[]): void => {
    for (const node of nodes) {
      if (node.type === 'definition') {
        if (!defs.has(node.identifier)) {
          defs.set(node.identifier, { url: node.url, title: node.title });
        }
      }
      const children = (node as { children?: RootContent[] }).children;
      if (Array.isArray(children)) walk(children);
    }
  };
  walk(root.children);
  return defs;
}

/**
 * Join pre-rendered blocks with a single blank line between them. Empty blocks
 * are dropped, so the result never contains a run of three-or-more newlines that
 * these renderers did not deliberately place (code blocks keep their own).
 */
export function joinBlocks(blocks: string[]): string {
  return blocks.filter((b) => b !== '').join('\n\n');
}

/** Strip leading and trailing blank lines without touching interior spacing. */
export function trimBlankEdges(text: string): string {
  return text.replace(/^\n+/, '').replace(/\n+$/, '');
}

/**
 * Prefix the first line with `first` and every subsequent line with `rest`.
 * Blank interior lines are left empty rather than carrying `rest` — so a nested
 * block never gains trailing whitespace and a blank line inside indented code
 * stays blank.
 */
export function indentLines(text: string, first: string, rest: string): string {
  const lines = text.split('\n');
  return lines
    .map((line, i) => (i === 0 ? first + line : line === '' ? '' : rest + line))
    .join('\n');
}
