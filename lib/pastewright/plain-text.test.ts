import { describe, expect, it } from 'vitest';
import { transform } from './transform';
import type { Destination, TableLayout } from './types';

function out(md: string, dest: Destination = 'plain', layout: TableLayout = 'auto'): string {
  return transform(md, dest, layout).text;
}

describe('plain-text: headings', () => {
  it('underlines h1 and h2 and leaves h3+ as plain lines', () => {
    expect(out('# Title')).toBe('Title\n═════');
    expect(out('## Title')).toBe('Title\n─────');
    expect(out('### Title')).toBe('Title');
  });

  it('separates headings from surrounding content with a blank line', () => {
    expect(out('# A\n\nbody')).toBe('A\n═\n\nbody');
  });
});

describe('plain-text: lists', () => {
  it('uses a Unicode bullet and keeps ordered numbering', () => {
    expect(out('- one\n- two')).toBe('• one\n• two');
    expect(out('1. one\n2. two')).toBe('1. one\n2. two');
  });

  it('indents nested lists under their parent', () => {
    expect(out('- a\n  - b\n    - c')).toBe('• a\n  • b\n    • c');
  });

  it('renders task-list state with accessible boxes', () => {
    expect(out('- [ ] todo\n- [x] done')).toBe('☐ todo\n☑ done');
  });
});

describe('plain-text: links and images', () => {
  it('expands a link to "label (url)"', () => {
    expect(out('[docs](https://e.com)')).toBe('docs (https://e.com)');
  });

  it('does not duplicate the URL when the label already is the URL', () => {
    expect(out('<https://e.com>')).toBe('https://e.com');
    expect(out('[https://e.com](https://e.com)')).toBe('https://e.com');
  });

  it('represents an image as "alt (url)"', () => {
    expect(out('![diagram](https://e.com/i.png)')).toBe('diagram (https://e.com/i.png)');
  });
});

describe('plain-text: blockquotes', () => {
  it('prefixes quoted lines for Plain and Slack', () => {
    expect(out('> hi', 'plain')).toBe('> hi');
    expect(out('> hi', 'slack')).toBe('> hi');
  });

  it('wraps a quote in typographic quotes for LinkedIn', () => {
    expect(out('> hi', 'linkedin')).toBe('“hi”');
  });
});

describe('plain-text: code', () => {
  it('keeps inline code backticked', () => {
    expect(out('use `run()` now')).toBe('use `run()` now');
  });

  it('preserves fenced code verbatim for Plain (no added indentation)', () => {
    expect(out('```js\n  const a = 1;\n```')).toBe('  const a = 1;');
  });

  it('wraps fenced code in a code fence for Slack', () => {
    expect(out('```\nx\n```', 'slack')).toBe('```\nx\n```');
  });

  it('never mangles internal code whitespace', () => {
    const code = 'line1\n    indented\n\n    blank-above';
    expect(out('```\n' + code + '\n```', 'plain')).toBe(code);
  });

  it('keeps a blank line inside a code block nested in a list verbatim (no indent added)', () => {
    const r = out('- text\n\n  ```\n  a\n\n  b\n  ```');
    // The code block's own blank line must stay empty, not become an indented "  ".
    expect(r).not.toMatch(/\n[ \t]+\n/);
  });
});

describe('plain-text: spacing hygiene', () => {
  it('leaves no trailing whitespace on blank lines in nested list content', () => {
    const r = out('- first\n\n  second');
    expect(r).not.toMatch(/[ \t]+\n/);
    expect(r).not.toMatch(/[ \t]+$/);
  });

  it('renders an empty list item as a bare marker with no trailing space', () => {
    expect(out('-\n- x')).toBe('•\n• x');
    expect(out('1.\n2. x')).toBe('1.\n2. x');
  });
});

describe('plain-text: emphasis and dangling punctuation', () => {
  it('removes emphasis markup but keeps the words', () => {
    const r = out('This is **bold**, _italic_, and ~~struck~~.');
    expect(r).toBe('This is bold, italic, and struck.');
    expect(r).not.toMatch(/[*_~]/);
  });
});

describe('plain-text: horizontal rules and spacing', () => {
  it('turns a thematic break into a modest separator', () => {
    const r = out('a\n\n---\n\nb');
    expect(r.split('\n\n')).toEqual(['a', '─'.repeat(24), 'b']);
  });

  it('never emits three-or-more consecutive newlines in prose', () => {
    const r = out('# H\n\n\n\npara\n\n\n\n- item');
    expect(r).not.toMatch(/\n{3,}/);
  });

  it('has no trailing or leading blank lines', () => {
    const r = out('\n\n# H\n\nbody\n\n\n');
    expect(r.startsWith('\n')).toBe(false);
    expect(r.endsWith('\n')).toBe(false);
  });
});

describe('plain-text: content fidelity', () => {
  it('preserves every word of a mixed document', () => {
    const md = [
      '# Report',
      '',
      'Intro **para** with a [link](https://e.com).',
      '',
      '- alpha',
      '- beta',
      '',
      '> a quote',
    ].join('\n');
    const r = out(md);
    for (const w of [
      'Report',
      'Intro',
      'para',
      'link',
      'https://e.com',
      'alpha',
      'beta',
      'a quote',
    ]) {
      expect(r).toContain(w);
    }
  });
});
