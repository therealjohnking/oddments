import { describe, expect, it } from 'vitest';
import { transform } from './transform';

function html(md: string): string {
  return transform(md, 'rich').html ?? '';
}

describe('rich-text: semantic elements', () => {
  it('renders heading levels', () => {
    expect(html('# a')).toContain('<h1>a</h1>');
    expect(html('###### f')).toContain('<h6>f</h6>');
  });

  it('renders strong, emphasis, strikethrough and inline code', () => {
    expect(html('**b**')).toContain('<strong>b</strong>');
    expect(html('_i_')).toContain('<em>i</em>');
    expect(html('~~s~~')).toContain('<del>s</del>');
    expect(html('`c`')).toContain('<code>c</code>');
  });

  it('renders ordered lists with a start attribute and unordered lists', () => {
    expect(html('- a\n- b')).toContain('<ul><li>a</li><li>b</li></ul>');
    expect(html('3. a\n4. b')).toContain('<ol start="3">');
  });

  it('renders blockquotes and fenced code as pre/code', () => {
    expect(html('> q')).toContain('<blockquote><p>q</p></blockquote>');
    expect(html('```\nx\n```')).toContain('<pre><code>x</code></pre>');
  });

  it('renders task items with box glyphs, not live checkboxes', () => {
    const h = html('- [x] done');
    expect(h).toContain('☑ done');
    expect(h).not.toContain('<input');
  });
});

describe('rich-text: tables', () => {
  it('builds a semantic table with alignment styles and every cell', () => {
    const h = html('| A | B |\n|:--|--:|\n| 1 | 2 |\n| 3 | 4 |');
    expect(h).toContain('<table>');
    expect(h).toContain('<thead>');
    expect(h).toContain('<th style="text-align:left">A</th>');
    expect(h).toContain('<th style="text-align:right">B</th>');
    for (const cell of ['1', '2', '3', '4']) expect(h).toContain(`>${cell}</td>`);
  });

  it('keeps inline formatting and links inside cells', () => {
    const h = html('| A |\n|---|\n| **b** and [l](https://e.com) |');
    expect(h).toContain('<strong>b</strong>');
    expect(h).toContain('<a href="https://e.com">l</a>');
  });
});

describe('rich-text: links and images', () => {
  it('renders a safe link as an anchor', () => {
    expect(html('[docs](https://e.com)')).toContain('<a href="https://e.com">docs</a>');
  });

  it('renders an image as a labelled link, never an <img> (no fetch/embed)', () => {
    const h = html('![alt](https://e.com/i.png)');
    expect(h).toContain('<a href="https://e.com/i.png">alt</a>');
    expect(h).not.toContain('<img');
  });
});

describe('rich-text: HTML safety (no XSS path)', () => {
  it('drops javascript: links to inert text', () => {
    const h = html('[x](javascript:alert(1))');
    expect(h).not.toContain('javascript');
    expect(h).not.toContain('<a ');
    expect(h).toContain('x');
  });

  it('escapes raw HTML from the source instead of emitting live markup', () => {
    const h = html('<img src=x onerror="alert(1)">');
    expect(h).not.toMatch(/<img/i);
    expect(h).toContain('&lt;img');
    expect(h).not.toContain('onerror="alert');
  });

  it('escapes a script tag in the source', () => {
    const h = html('<script>alert(1)</script>');
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('escapes &, <, > and quotes in ordinary text', () => {
    const h = html('a < b & c > d "q"');
    expect(h).toContain('&lt;');
    expect(h).toContain('&amp;');
    expect(h).toContain('&gt;');
    expect(h).toContain('&quot;');
  });

  it('escapes dangerous characters that appear inside a href', () => {
    // A crafted URL that survives the scheme check must still be attribute-escaped.
    const h = html('[x](https://e.com/"><script>)');
    expect(h).not.toContain('"><script>');
  });
});

describe('rich-text: plain-text fallback', () => {
  it('provides a useful text/plain alongside the html', () => {
    const r = transform('| A | B |\n|---|---|\n| 1 | 2 |', 'rich');
    expect(r.text.length).toBeGreaterThan(0);
    for (const cell of ['A', 'B', '1', '2']) expect(r.text).toContain(cell);
  });
});
