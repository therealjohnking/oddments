import { describe, expect, it } from 'vitest';
import { transform } from './transform';

function out(md: string): string {
  return transform(md, 'reddit').text;
}

describe('reddit: preserves compatible Markdown', () => {
  it('keeps headings, bold, italic and strikethrough', () => {
    expect(out('## Heading')).toContain('## Heading');
    expect(out('**b**')).toContain('**b**');
    expect(out('~~s~~')).toContain('~~s~~');
  });

  it('keeps Markdown links', () => {
    expect(out('[l](https://e.com)')).toContain('[l](https://e.com)');
  });

  it('keeps a pipe table (Reddit Markdown mode supports tables)', () => {
    const r = out('| A | B |\n|---|---|\n| 1 | 2 |');
    expect(r).toMatch(/\|\s*A\s*\|/);
    expect(r).toMatch(/\| *-+ *\|/); // a Markdown header-separator row
    expect(r).toContain('1');
    expect(r).toContain('2');
  });

  it('keeps fenced code with its language label', () => {
    expect(out('```ts\nconst a = 1;\n```')).toContain('```ts');
  });

  it('leaves already-compatible source largely unchanged', () => {
    const md = '# Title\n\nA paragraph with **bold** text.';
    const r = out(md);
    expect(r).toContain('# Title');
    expect(r).toContain('**bold**');
  });
});

describe('reddit: adapts constructs Reddit can’t show', () => {
  it('converts images to links (no embedded image in a text post)', () => {
    const r = out('![alt](https://e.com/i.png)');
    expect(r).not.toContain('![');
    expect(r).toContain('[alt](https://e.com/i.png)');
  });

  it('converts task-list checkboxes to box-glyph bullets', () => {
    const r = out('- [ ] todo\n- [x] done');
    expect(r).not.toContain('[ ]');
    expect(r).not.toContain('[x]');
    expect(r).toContain('☐ todo');
    expect(r).toContain('☑ done');
  });

  it('converts reference-style images to links too', () => {
    const r = out('![logo][l]\n\n[l]: https://x.com/i.png');
    expect(r).not.toContain('![');
    expect(r).toContain('https://x.com/i.png');
    expect(r).toContain('[logo]');
  });

  it('collapses an image used as link text instead of emitting a nested link', () => {
    const r = out('[![alt](https://x.com/i.png)](https://dest.com)');
    expect(r).toContain('[alt](https://dest.com)');
    expect(r).not.toContain('](https://x.com/i.png)]'); // no [ [..](img) ](dest) nesting
  });

  it('reports the image and task adaptations', () => {
    const result = transform('![a](https://e.com/i.png)\n\n- [ ] t', 'reddit');
    const cats = result.findings.map((f) => f.category);
    expect(cats).toContain('images');
    expect(cats).toContain('lists');
  });
});
