import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './parse';
import type { Heading, List, ListItem, Table, Code, Link, Image } from 'mdast';

/** Find the first node of a type anywhere in the tree. */
function find<T>(root: unknown, type: string): T | undefined {
  const stack: unknown[] = [root];
  while (stack.length) {
    const node = stack.pop() as { type?: string; children?: unknown[] };
    if (node?.type === type) return node as T;
    if (Array.isArray(node?.children)) stack.push(...node.children);
  }
  return undefined;
}

describe('parseMarkdown (CommonMark + GFM)', () => {
  it('parses paragraphs and ATX headings with depth', () => {
    const h = find<Heading>(parseMarkdown('## Title'), 'heading');
    expect(h?.depth).toBe(2);
  });

  it('parses strong, emphasis and GFM strikethrough as distinct nodes', () => {
    const tree = parseMarkdown('**b** _i_ ~~s~~');
    expect(find(tree, 'strong')).toBeTruthy();
    expect(find(tree, 'emphasis')).toBeTruthy();
    expect(find(tree, 'delete')).toBeTruthy();
  });

  it('parses links, autolinks and images', () => {
    const link = find<Link>(parseMarkdown('[a](https://e.com)'), 'link');
    expect(link?.url).toBe('https://e.com');
    const auto = find<Link>(parseMarkdown('<https://auto.link>'), 'link');
    expect(auto?.url).toBe('https://auto.link');
    const img = find<Image>(parseMarkdown('![alt](https://e.com/i.png)'), 'image');
    expect(img?.url).toBe('https://e.com/i.png');
    expect(img?.alt).toBe('alt');
  });

  it('parses inline code and fenced code with a language label', () => {
    expect(find(parseMarkdown('`x`'), 'inlineCode')).toBeTruthy();
    const code = find<Code>(parseMarkdown('```ts\nconst a = 1;\n```'), 'code');
    expect(code?.lang).toBe('ts');
    expect(code?.value).toBe('const a = 1;');
  });

  it('parses ordered, unordered, nested and task lists with state', () => {
    const tree = parseMarkdown('- [ ] a\n- [x] b\n  - c');
    const list = find<List>(tree, 'list');
    expect(list?.ordered).toBe(false);
    const items = (list?.children ?? []) as ListItem[];
    expect(items[0]?.checked).toBe(false);
    expect(items[1]?.checked).toBe(true);
    // nested list exists somewhere in the tree
    const nested = parseMarkdown('1. a\n   1. b');
    const outer = find<List>(nested, 'list');
    expect(outer?.ordered).toBe(true);
  });

  it('parses a GFM table with alignment metadata and escaped pipes', () => {
    const table = find<Table>(parseMarkdown('| A | B |\n|:--|--:|\n| `x\\|y` | 2 |'), 'table');
    expect(table?.align).toEqual(['left', 'right']);
    // The escaped pipe survives as a literal pipe inside the cell's inline code.
    const code = find<{ value: string }>(table, 'inlineCode');
    expect(code?.value).toBe('x|y');
  });

  it('parses blockquotes and thematic breaks', () => {
    expect(find(parseMarkdown('> quote'), 'blockquote')).toBeTruthy();
    expect(find(parseMarkdown('a\n\n---\n\nb'), 'thematicBreak')).toBeTruthy();
  });

  it('keeps raw HTML as distinct html nodes (never parsed into elements)', () => {
    const tree = parseMarkdown('<div>x</div>');
    expect(find<{ value: string }>(tree, 'html')?.value).toContain('<div>');
  });

  it('preserves escaped punctuation', () => {
    const tree = parseMarkdown('a \\* b');
    const text = find<{ value: string }>(tree, 'text');
    expect(text?.value).toContain('*');
  });

  it('handles empty and malformed input without throwing', () => {
    expect(() => parseMarkdown('')).not.toThrow();
    expect(parseMarkdown('').children).toEqual([]);
    expect(() => parseMarkdown('| broken | table\n no pipes here')).not.toThrow();
    expect(() => parseMarkdown('```\nunclosed fence')).not.toThrow();
    expect(() => parseMarkdown('[bad](')).not.toThrow();
  });
});
