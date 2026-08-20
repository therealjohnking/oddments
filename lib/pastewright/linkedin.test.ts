import { describe, expect, it } from 'vitest';
import type { Table } from 'mdast';
import { transform } from './transform';
import { parseMarkdown } from './parse';
import { emptyStats } from './types';
import { PLAIN_POLICIES } from './profiles';
import type { InlineCtx } from './inline';
import { extractTable, resolveLayout } from './tables';

const TABLE = [
  '| Vendor | Setup | Monthly | Best for |',
  '|---|--:|--:|---|',
  '| Atlas | $0 | $29 | Small teams getting started |',
  '| Beacon | $199 | $49 | Scheduled reporting |',
].join('\n');

function tableModel(md: string) {
  const table = parseMarkdown(md).children.find((n): n is Table => n.type === 'table');
  if (!table) throw new Error('no table');
  return extractTable(table, {
    policy: PLAIN_POLICIES.plain,
    stats: emptyStats(),
    defs: new Map(),
  } as InlineCtx);
}

describe('LinkedIn: tables are records-only', () => {
  it('resolves Auto to records', () => {
    expect(resolveLayout(tableModel(TABLE), 'linkedin', 'auto')).toBe('records');
  });

  it('can never resolve to an aligned/wrapped layout, even when Aligned is selected', () => {
    const table = tableModel(TABLE);
    expect(resolveLayout(table, 'linkedin', 'aligned')).toBe('records');
    expect(resolveLayout(table, 'linkedin', 'records')).toBe('records');
    // The rendered output is never a bordered table (no pipe separators).
    const forced = transform(TABLE, 'linkedin', 'aligned').text;
    expect(forced).not.toContain('|');
    expect(forced).toContain('Vendor Atlas'); // it is the record layout
  });

  it('offers no table-layout control for LinkedIn', () => {
    expect(transform(TABLE, 'linkedin').showTableControl).toBe(false);
  });

  it('preserves every header, row and cell in the record conversion', () => {
    const text = transform(TABLE, 'linkedin', 'auto').text;
    for (const token of [
      'Vendor',
      'Setup',
      'Monthly',
      'Best for',
      'Atlas',
      '$0',
      '$29',
      'Small teams getting started',
      'Beacon',
      '$199',
      '$49',
      'Scheduled reporting',
    ]) {
      expect(text).toContain(token);
    }
  });

  it('uses the first-column value as the record heading, then header/value pairs', () => {
    const text = transform(TABLE, 'linkedin', 'auto').text;
    expect(text).toContain('Vendor Atlas');
    expect(text).toContain('Setup: $0');
    expect(text).toContain('Monthly: $29');
    expect(text).toContain('Best for: Small teams getting started');
    // Records are separated by a blank line; no bullets or decoration are added.
    expect(text).toContain('Vendor Atlas\nSetup: $0');
    expect(text).not.toMatch(/^[•\-*]/m);
  });

  it('does not redundantly repeat the first header when the value already leads with it', () => {
    const md = [
      '| Capability | What it proves | Payoff |',
      '|---|---|---|',
      '| Capability capital | You can ship with AI | Career credibility |',
      '| Creative capital | You have product taste | Personal brand |',
    ].join('\n');
    const text = transform(md, 'linkedin').text;
    expect(text).toContain('Capability capital\nWhat it proves: You can ship with AI');
    expect(text).not.toContain('Capability Capability capital'); // header not doubled
    // The header word is still present (as the first word of the heading), not lost.
    expect(text).toContain('Creative capital');
  });

  it('handles an empty first-column value sensibly (no header masquerading as data)', () => {
    const text = transform('| Name | Email |\n|---|---|\n|  | a@x.com |', 'linkedin').text;
    expect(text).toContain('Name:');
    expect(text).toContain('Email: a@x.com');
  });
});

describe('LinkedIn: headings are plain section labels (no box-drawing underline)', () => {
  it('renders headings as plain text without a rule underline', () => {
    expect(transform('# Big title', 'linkedin').text).toBe('Big title');
    expect(transform('## Section', 'linkedin').text).toBe('Section');
    expect(transform('### Sub', 'linkedin').text).toBe('Sub');
  });

  it('emits no box-drawing characters anywhere in LinkedIn output', () => {
    const text = transform('# H1\n\n## H2\n\ntext\n\n---', 'linkedin').text;
    expect(text).not.toContain('═');
    expect(text).not.toContain('─');
  });

  it('keeps the box-drawing heading underline for Plain and Slack (monospace surfaces)', () => {
    expect(transform('# H', 'plain').text).toBe('H\n═');
    expect(transform('## H', 'slack').text).toBe('H\n─');
  });
});

describe('LinkedIn: horizontal rules are a restrained separator', () => {
  it('renders a thematic break as a single em dash on its own line', () => {
    expect(transform('---', 'linkedin').text).toBe('—');
    expect(transform('a\n\n---\n\nb', 'linkedin').text).toBe('a\n\n—\n\nb');
  });

  it('never emits a long repeated ASCII/Unicode rule for LinkedIn', () => {
    const text = transform('above\n\n***\n\nbelow', 'linkedin').text;
    expect(text).not.toMatch(/—{2,}/); // no repeated em dashes
    expect(text).not.toMatch(/-{3,}/); // no long ASCII rule
    expect(text).not.toContain('─'); // no box-drawing rule
    expect(text).not.toContain('___');
  });
});

describe('other destinations are unchanged by the LinkedIn policy', () => {
  it('Plain still offers aligned columns and renders a bordered table', () => {
    expect(transform(TABLE, 'plain').showTableControl).toBe(true);
    const aligned = transform('| A | B |\n|---|---|\n| 1 | 2 |', 'plain', 'aligned').text;
    expect(aligned.split('\n')[0]).toBe('| A | B |');
    expect(aligned.split('\n')[1]).toBe('|---|---|');
  });

  it('Plain still renders a horizontal rule as its box-drawing separator', () => {
    expect(transform('---', 'plain').text).toBe('─'.repeat(24));
  });

  it('Slack still renders compact tables as aligned columns inside a code fence', () => {
    const slack = transform('| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |', 'slack', 'auto').text;
    expect(slack.startsWith('```')).toBe(true);
    expect(slack).toContain('| A | B | C |');
  });

  it('Reddit still keeps a Markdown pipe table', () => {
    const reddit = transform(TABLE, 'reddit').text;
    expect(reddit).toMatch(/\|\s*Vendor\s*\|/);
    expect(reddit).toMatch(/\| *-+ *\|/);
  });

  it('Rich still renders a semantic HTML table', () => {
    expect(transform(TABLE, 'rich').html).toContain('<table>');
  });
});
