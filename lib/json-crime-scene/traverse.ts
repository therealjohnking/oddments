/**
 * Traversal — one iterative pass over the strict syntax tree that produces the
 * domain node tree the UI renders, the headline structural statistics, and the
 * duplicate-key record (which a plain `JSON.parse` would have silently erased).
 *
 * The walk is explicitly stack-based rather than recursive: a document that
 * parsed successfully can still be nested deeply enough to overflow a naïve
 * recursive traversal, so we never recurse over user input. Children are placed
 * into pre-sized arrays by index, so document order is preserved regardless of
 * the stack's LIFO processing order.
 */

import type { Node } from 'jsonc-parser';
import type { Hotspot, JsonKind, JsonNode, StructureStats } from './types';
import { toJsonPointer } from './paths';

/** Bounded preview length for scalar values stored on each node. */
export const PREVIEW_CAP = 200;

/** One key that appears more than once inside a single object. */
export interface RawDuplicateGroup {
  objectPointer: string;
  key: string;
  count: number;
  /** Source offset of each occurrence's key token. */
  keyOffsets: number[];
}

export interface TraverseResult {
  tree: JsonNode;
  stats: StructureStats;
  duplicateGroups: RawDuplicateGroup[];
}

interface Work {
  node: Node;
  target: (JsonNode | undefined)[];
  targetIndex: number;
  key?: string;
  keyRaw?: string;
  index?: number;
  depth: number;
  path: (string | number)[];
  duplicateKey?: boolean;
}

/** Make a bounded, single-line, display-safe preview of a decoded string. */
export function previewString(
  value: string,
  cap = PREVIEW_CAP,
): { preview: string; truncated: boolean } {
  let out = '';
  let consumed = 0;
  let truncated = false;
  for (const ch of value) {
    const cp = ch.codePointAt(0)!;
    let piece: string;
    if (cp === 0x0a) piece = '\\n';
    else if (cp === 0x0d) piece = '\\r';
    else if (cp === 0x09) piece = '\\t';
    // Escape everything that would break a single-line preview: C0 controls, DEL
    // and the C1 block (which includes NEL U+0085), and the Unicode line and
    // paragraph separators (U+2028/U+2029) — all of which can force a line break
    // or paint nothing, even under `white-space: nowrap`.
    else if (cp < 0x20 || (cp >= 0x7f && cp <= 0x9f) || cp === 0x2028 || cp === 0x2029)
      piece = '\\u' + cp.toString(16).padStart(4, '0');
    else piece = ch;

    // Check before appending so the result never exceeds the cap (a trailing
    // escape is up to 6 units, which a top-of-loop check would overshoot).
    if (out.length + piece.length > cap) {
      truncated = true;
      break;
    }
    out += piece;
    consumed++;
  }
  if (!truncated && consumed < countCodePoints(value)) truncated = true;
  return { preview: out, truncated };
}

function countCodePoints(value: string): number {
  let n = 0;
  for (const _ of value) n++;
  return n;
}

function emptyStats(rootKind: JsonKind): StructureStats {
  return {
    rootKind,
    totalNodes: 0,
    objects: 0,
    arrays: 0,
    strings: 0,
    numbers: 0,
    booleans: 0,
    nulls: 0,
    properties: 0,
    maxDepth: 0,
    deepest: null,
    longestString: null,
    largestArray: null,
    largestObject: null,
    sourceBytes: 0,
    duplicateKeyGroups: 0,
  };
}

const KIND_BY_TYPE: Record<string, JsonKind> = {
  object: 'object',
  array: 'array',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
};

/**
 * Build the domain tree and statistics from a jsonc syntax tree and its source.
 * The tree is assumed to be for *valid* JSON (every value node well-formed).
 */
export function traverse(root: Node, source: string): TraverseResult {
  const rootKind = KIND_BY_TYPE[root.type] ?? 'null';
  const stats = emptyStats(rootKind);
  const duplicateGroups: RawDuplicateGroup[] = [];

  const holder: (JsonNode | undefined)[] = [undefined];
  const stack: Work[] = [{ node: root, target: holder, targetIndex: 0, depth: 0, path: [] }];

  while (stack.length > 0) {
    const work = stack.pop()!;
    const node = work.node;
    const kind = KIND_BY_TYPE[node.type] ?? 'null';
    const pointer = toJsonPointer(work.path);

    const dom: JsonNode = {
      id: `n${node.offset}`,
      kind,
      pointer,
      path: work.path,
      depth: work.depth,
      offset: node.offset,
      length: node.length,
      childCount: 0,
    };
    if (work.key !== undefined) {
      dom.key = work.key;
      dom.keyRaw = work.keyRaw;
      if (work.duplicateKey) dom.duplicateKey = true;
    }
    if (work.index !== undefined) dom.index = work.index;

    stats.totalNodes++;
    if (work.depth > stats.maxDepth) {
      stats.maxDepth = work.depth;
      stats.deepest = { pointer, value: work.depth };
    }

    switch (kind) {
      case 'object': {
        stats.objects++;
        const props = (node.children ?? []).filter((c) => c.type === 'property');
        dom.childCount = props.length;
        stats.properties += props.length;
        if (props.length > (stats.largestObject?.value ?? -1)) {
          stats.largestObject = { pointer, value: props.length };
        }
        const children: (JsonNode | undefined)[] = new Array(props.length);
        dom.children = children as JsonNode[];

        // Pre-scan keys to detect duplicates and record their offsets.
        const occurrences = new Map<string, number[]>();
        for (const prop of props) {
          const keyNode = prop.children?.[0];
          const keyName = typeof keyNode?.value === 'string' ? keyNode.value : '';
          const list = occurrences.get(keyName);
          if (list) list.push(keyNode?.offset ?? prop.offset);
          else occurrences.set(keyName, [keyNode?.offset ?? prop.offset]);
        }
        for (const [key, offsets] of occurrences) {
          if (offsets.length > 1) {
            duplicateGroups.push({
              objectPointer: pointer,
              key,
              count: offsets.length,
              keyOffsets: offsets,
            });
          }
        }

        // Queue each member's value node.
        for (let i = 0; i < props.length; i++) {
          const prop = props[i]!;
          const keyNode = prop.children?.[0];
          const valNode = prop.children?.[1];
          const keyName = typeof keyNode?.value === 'string' ? keyNode.value : '';
          const isDup = (occurrences.get(keyName)?.length ?? 0) > 1;
          const keyRaw = keyNode
            ? source.slice(keyNode.offset, keyNode.offset + keyNode.length)
            : '""';
          if (!valNode) {
            // Defensive: a property with no value shouldn't occur in valid JSON.
            children[i] = {
              id: `n${prop.offset}k`,
              kind: 'null',
              pointer: toJsonPointer([...work.path, keyName]),
              path: [...work.path, keyName],
              depth: work.depth + 1,
              key: keyName,
              keyRaw,
              offset: prop.offset,
              length: prop.length,
              childCount: 0,
              preview: 'null',
            };
            stats.totalNodes++;
            stats.nulls++;
            continue;
          }
          stack.push({
            node: valNode,
            target: children,
            targetIndex: i,
            key: keyName,
            keyRaw,
            depth: work.depth + 1,
            path: [...work.path, keyName],
            duplicateKey: isDup,
          });
        }
        break;
      }
      case 'array': {
        stats.arrays++;
        const elems = node.children ?? [];
        dom.childCount = elems.length;
        if (elems.length > (stats.largestArray?.value ?? -1)) {
          stats.largestArray = { pointer, value: elems.length };
        }
        const children: (JsonNode | undefined)[] = new Array(elems.length);
        dom.children = children as JsonNode[];
        for (let i = 0; i < elems.length; i++) {
          stack.push({
            node: elems[i]!,
            target: children,
            targetIndex: i,
            index: i,
            depth: work.depth + 1,
            path: [...work.path, i],
          });
        }
        break;
      }
      case 'string': {
        stats.strings++;
        const value = typeof node.value === 'string' ? node.value : '';
        const { preview, truncated } = previewString(value);
        dom.preview = preview;
        if (truncated) dom.truncatedPreview = true;
        dom.stringLength = value.length;
        if (value.length > (stats.longestString?.value ?? -1)) {
          stats.longestString = {
            pointer,
            value: value.length,
            label: truncated ? preview + '…' : preview,
          };
        }
        break;
      }
      case 'number': {
        stats.numbers++;
        const raw = source.slice(node.offset, node.offset + node.length);
        dom.raw = raw;
        dom.numberValue = typeof node.value === 'number' ? node.value : Number(raw);
        dom.preview = raw.length > PREVIEW_CAP ? raw.slice(0, PREVIEW_CAP) + '…' : raw;
        break;
      }
      case 'boolean': {
        stats.booleans++;
        dom.booleanValue = node.value === true;
        dom.preview = dom.booleanValue ? 'true' : 'false';
        break;
      }
      default: {
        stats.nulls++;
        dom.preview = 'null';
        break;
      }
    }

    work.target[work.targetIndex] = dom;
  }

  // The stack-based walk visits sibling objects last-first, so groups are
  // collected out of order; sort them by their first key's offset so downstream
  // findings (and the tree-jump target) follow document order.
  duplicateGroups.sort((a, b) => (a.keyOffsets[0] ?? 0) - (b.keyOffsets[0] ?? 0));
  stats.duplicateKeyGroups = duplicateGroups.length;
  stats.sourceBytes = utf8ByteLength(source);

  return { tree: holder[0]!, stats, duplicateGroups };
}

/** UTF-8 byte length of a string (TextEncoder-free, so it runs anywhere). */
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff) {
      // High surrogate: a well-formed pair encodes to 4 bytes.
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        bytes += 4;
        i++;
      } else {
        bytes += 3; // lone surrogate; count as replacement-sized
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}
