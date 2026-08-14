/**
 * Local, bounded search across the parsed structure. It matches property names
 * and scalar value previews — enough to locate a key or a value and jump to it —
 * without implementing a query language. Results are capped so a broad query on
 * a large document can never flood the UI; the true match total is still
 * reported.
 */

import type { JsonNode, SearchHit, SearchResult } from './types';

export const SEARCH_LIMIT = 200;

export interface SearchOptions {
  caseSensitive?: boolean;
  matchKeys?: boolean;
  matchValues?: boolean;
  limit?: number;
}

function scalarSearchText(node: JsonNode): string | null {
  switch (node.kind) {
    case 'string':
    case 'number':
      return node.preview ?? '';
    case 'boolean':
      return node.booleanValue ? 'true' : 'false';
    case 'null':
      return 'null';
    default:
      return null;
  }
}

/** Search property names and scalar value previews for `query`. */
export function searchTree(
  tree: JsonNode,
  query: string,
  options: SearchOptions = {},
): SearchResult {
  const {
    caseSensitive = false,
    matchKeys = true,
    matchValues = true,
    limit = SEARCH_LIMIT,
  } = options;

  const trimmed = query;
  if (trimmed.length === 0) {
    return { query, hits: [], total: 0, capped: false };
  }
  const needle = caseSensitive ? trimmed : trimmed.toLowerCase();
  const contains = (haystack: string): boolean =>
    (caseSensitive ? haystack : haystack.toLowerCase()).includes(needle);

  const hits: SearchHit[] = [];
  let total = 0;
  const stack: JsonNode[] = [tree];

  while (stack.length > 0) {
    const node = stack.pop()!;

    if (matchKeys && node.key !== undefined && contains(node.key)) {
      total++;
      if (hits.length < limit) {
        hits.push({
          nodeId: node.id,
          pointer: node.pointer,
          where: 'key',
          kind: node.kind,
          preview: previewFor(node, 'key'),
        });
      }
    }

    if (matchValues) {
      const text = scalarSearchText(node);
      if (text !== null && contains(text)) {
        total++;
        if (hits.length < limit) {
          hits.push({
            nodeId: node.id,
            pointer: node.pointer,
            where: 'value',
            kind: node.kind,
            preview: previewFor(node, 'value'),
          });
        }
      }
    }

    // Push children in reverse so pre-order pop visits them in document order.
    if (node.children)
      for (let i = node.children.length - 1; i >= 0; i--) stack.push(node.children[i]!);
  }

  return { query, hits, total, capped: total > hits.length };
}

function previewFor(node: JsonNode, where: 'key' | 'value'): string {
  if (where === 'key') {
    const key = node.key ?? '';
    return key.length > 80 ? key.slice(0, 80) + '…' : key;
  }
  return node.preview ?? '';
}
