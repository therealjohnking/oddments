/**
 * Derived representations — pretty, minified, and (optionally) key-sorted views
 * of the document. These never touch the original source; they are freshly
 * emitted from the domain tree.
 *
 * Two properties matter for correctness:
 *
 *   • **Lossless.** Every scalar is emitted from its exact source slice, so a
 *     precision-losing number like 9223372036854775807 is reproduced digit-for-
 *     digit rather than round-tripped through a JavaScript double.
 *
 *   • **Duplicate-safe.** Members are emitted in document order without
 *     de-duplication, so a `parse → stringify` round trip cannot silently drop an
 *     earlier duplicate key. Key-sorting *does* reorder members, which is unsafe
 *     when duplicates exist (their relative order is meaningful to some systems),
 *     so callers must gate it on `canSortKeys`.
 *
 * The emitter is iterative (an explicit work stack) so deeply nested input can
 * never overflow the call stack.
 */

import type { JsonNode } from './types';

interface EmitOptions {
  indentUnit: string;
  newline: string;
  colonSpace: string;
  sortKeys: boolean;
}

type Frame = { kind: 'text'; text: string } | { kind: 'node'; node: JsonNode; depth: number };

function scalarText(node: JsonNode, source: string): string {
  // The exact source slice is faithful for every scalar kind.
  return source.slice(node.offset, node.offset + node.length);
}

function keyText(member: JsonNode): string {
  return member.keyRaw ?? JSON.stringify(member.key ?? '');
}

function emit(tree: JsonNode, source: string, opts: EmitOptions): string {
  const out: string[] = [];
  const stack: Frame[] = [{ kind: 'node', node: tree, depth: 0 }];

  while (stack.length > 0) {
    const frame = stack.pop()!;
    if (frame.kind === 'text') {
      out.push(frame.text);
      continue;
    }

    const { node, depth } = frame;
    if (node.kind !== 'object' && node.kind !== 'array') {
      out.push(scalarText(node, source));
      continue;
    }

    const children = node.children ?? [];
    if (children.length === 0) {
      out.push(node.kind === 'object' ? '{}' : '[]');
      continue;
    }

    const open = node.kind === 'object' ? '{' : '[';
    const close = node.kind === 'object' ? '}' : ']';
    const inner = opts.indentUnit.repeat(depth + 1);
    const outer = opts.indentUnit.repeat(depth);

    const members =
      node.kind === 'object' && opts.sortKeys
        ? [...children].sort((a, b) => (a.key ?? '').localeCompare(b.key ?? ''))
        : children;

    // Build the frames in forward order, then push reversed so they pop forward.
    const pieces: Frame[] = [];
    pieces.push({ kind: 'text', text: open + opts.newline });
    members.forEach((child, i) => {
      const prefix =
        node.kind === 'object' ? inner + keyText(child) + ':' + opts.colonSpace : inner;
      pieces.push({ kind: 'text', text: prefix });
      pieces.push({ kind: 'node', node: child, depth: depth + 1 });
      pieces.push({
        kind: 'text',
        text: (i < members.length - 1 ? ',' : '') + opts.newline,
      });
    });
    pieces.push({ kind: 'text', text: outer + close });

    for (let i = pieces.length - 1; i >= 0; i--) stack.push(pieces[i]!);
  }

  return out.join('');
}

/** Conventional formatted JSON, indented with `indent` spaces (default 2). */
export function toPretty(tree: JsonNode, source: string, indent = 2): string {
  return emit(tree, source, {
    indentUnit: ' '.repeat(indent),
    newline: '\n',
    colonSpace: ' ',
    sortKeys: false,
  });
}

/** Compact JSON with no insignificant whitespace. */
export function toMinified(tree: JsonNode, source: string): string {
  return emit(tree, source, { indentUnit: '', newline: '', colonSpace: '', sortKeys: false });
}

/**
 * Pretty JSON with every object's members sorted by key. This reorders members,
 * so it is only offered when there are no duplicate keys — see `canSortKeys`.
 */
export function toSortedKeys(tree: JsonNode, source: string, indent = 2): string {
  return emit(tree, source, {
    indentUnit: ' '.repeat(indent),
    newline: '\n',
    colonSpace: ' ',
    sortKeys: true,
  });
}

/** Key-sorting is unsafe when duplicate keys exist (their order is meaningful). */
export function canSortKeys(hasDuplicateKeys: boolean): boolean {
  return !hasDuplicateKeys;
}
