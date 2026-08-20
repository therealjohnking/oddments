'use client';

import { createElement, type ReactNode } from 'react';
import type { RichNode } from '@/lib/pastewright';

/**
 * Render the controlled `RichNode` tree as React elements — never via
 * `dangerouslySetInnerHTML`. Text nodes become plain strings, which React
 * escapes, so the preview shares the engine's guarantee that nothing from the
 * source Markdown can become live markup.
 */
function toReact(node: RichNode, key: number): ReactNode {
  if (node.kind === 'text') return node.value;
  const { tag, attrs, children } = node;
  const props: Record<string, unknown> = { key };
  if (attrs?.href !== undefined) {
    props.href = attrs.href;
    props.target = '_blank';
    props.rel = 'noreferrer noopener';
  }
  if (attrs?.start !== undefined) props.start = attrs.start;
  if (attrs?.align !== undefined) props.style = { textAlign: attrs.align };
  if (tag === 'br' || tag === 'hr') return createElement(tag, props);
  return createElement(
    tag,
    props,
    children.map((child, index) => toReact(child, index)),
  );
}

export function RichPreview({ nodes }: { nodes: RichNode[] }) {
  return <>{nodes.map((node, index) => toReact(node, index))}</>;
}
