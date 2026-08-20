import { describe, expect, it } from 'vitest';
import type { Table } from 'mdast';
import { parseMarkdown } from './parse';
import { emptyStats } from './types';
import { PLAIN_POLICIES } from './profiles';
import type { InlineCtx } from './inline';
import {
  extractTable,
  renderAligned,
  renderRecords,
  chooseAutoLayout,
  resolveLayout,
  columnWidths,
} from './tables';
import { displayWidth } from './width';

function ctx(): InlineCtx {
  return { policy: PLAIN_POLICIES.plain, stats: emptyStats(), defs: new Map() };
}

function tableNode(md: string): Table {
  const root = parseMarkdown(md);
  const table = root.children.find((n) => n.type === 'table');
  if (!table || table.type !== 'table') throw new Error('no table parsed');
  return table;
}

const COMPACT = [
  '| Option | Cost | Rating |',
  '|---|--:|--:|',
  '| A | $10 | 8 |',
  '| B | $20 | 9 |',
].join('\n');

const WIDE = [
  '| Vendor | Setup | Monthly | Best for | Main limitation | Notes |',
  '|---|---|---|---|---|---|',
  '| Atlas | $0 | $29 | Small teams getting started here | Limited data export options | ok |',
].join('\n');

// Three columns, but long cells that overflow a single physical line → wrapped.
const WIDE_3 = [
  '| Feature | Description | Notes |',
  '|---|---|---|',
  '| Export | Send your data to a CSV or JSON file for backup and archival | Works offline |',
  '| Sync | Continuously reconcile records across every connected device | Needs an account |',
].join('\n');

describe('extractTable', () => {
  it('captures headers, rows, columns and alignment', () => {
    const model = extractTable(tableNode(COMPACT), ctx());
    expect(model.columns).toBe(3);
    expect(model.header).toEqual(['Option', 'Cost', 'Rating']);
    expect(model.align).toEqual([null, 'right', 'right']);
    expect(model.rows).toEqual([
      ['A', '$10', '8'],
      ['B', '$20', '9'],
    ]);
  });

  it('preserves escaped pipes, inline code and emphasis text inside cells', () => {
    const model = extractTable(
      tableNode('| A | B |\n|---|---|\n| `x\\|y` | **bold** and _it_ |'),
      ctx(),
    );
    expect(model.rows[0]).toEqual(['`x|y`', 'bold and it']);
  });

  it('pads short rows and keeps extra cells so nothing is ever dropped', () => {
    const model = extractTable(
      tableNode('| A | B | C |\n|---|---|---|\n| 1 |\n| 1 | 2 | 3 | 4 |'),
      ctx(),
    );
    // A short row is padded out; a long row keeps its extra cell (never silently dropped).
    expect(model.columns).toBeGreaterThanOrEqual(3);
    expect(model.rows[0]![0]).toBe('1');
    expect(model.rows[0]!.slice(1).every((c) => c === '')).toBe(true);
    expect(model.rows[1]).toEqual(['1', '2', '3', '4']);
  });

  it('handles a single-row (header-only) table', () => {
    const model = extractTable(tableNode('| A | B |\n|---|---|'), ctx());
    expect(model.rows).toEqual([]);
    expect(model.header).toEqual(['A', 'B']);
  });
});

describe('renderAligned (bordered, compact)', () => {
  it('draws borders, a header separator, and no trailing whitespace', () => {
    const out = renderAligned(extractTable(tableNode(COMPACT), ctx()));
    const lines = out.split('\n');
    expect(lines[0]).toBe('| Option | Cost | Rating |');
    expect(lines[1]).toBe('|--------|------|--------|'); // header separator
    for (const line of lines) {
      expect(line.startsWith('|')).toBe(true);
      expect(line.endsWith('|')).toBe(true);
      expect(line).toBe(line.replace(/[ \t]+$/, '')); // never trailing whitespace
    }
    // A compact table needs no wrapping, so every physical line is the same width.
    const widths = new Set(lines.map((l) => displayWidth(l)));
    expect(widths.size).toBe(1);
  });

  it('right-aligns the numeric columns within their cells', () => {
    const out = renderAligned(extractTable(tableNode(COMPACT), ctx()));
    // "$10"/"$20" hug the right of the (right-aligned) Cost column.
    expect(out).toContain('|  $10 |');
    expect(out).toContain('|      8 |');
  });

  it('aligns CJK content by display width without splitting graphemes', () => {
    const out = renderAligned(
      extractTable(tableNode('| K | V |\n|---|---|\n| 日本 | x |\n| a | y |'), ctx()),
    );
    const lines = out.split('\n');
    // Compact CJK table: borders line up, every line the same display width.
    const widths = new Set(lines.map((l) => displayWidth(l)));
    expect(widths.size).toBe(1);
    expect(out).toContain('日本');
  });

  it('keeps every header and cell present', () => {
    const out = renderAligned(extractTable(tableNode(COMPACT), ctx()));
    for (const token of ['Option', 'Cost', 'Rating', 'A', '$10', '8', 'B', '$20', '9']) {
      expect(out).toContain(token);
    }
  });
});

describe('renderRecords', () => {
  it('renders one labelled block per row, first column as the title', () => {
    const out = renderRecords(extractTable(tableNode(COMPACT), ctx()));
    expect(out).toBe(
      ['Option A', 'Cost: $10', 'Rating: 8', '', 'Option B', 'Cost: $20', 'Rating: 9'].join('\n'),
    );
  });

  it('keeps empty cells as a labelled line so nothing is dropped', () => {
    const out = renderRecords(extractTable(tableNode('| A | B |\n|---|---|\n| x | |'), ctx()));
    expect(out).toContain('A x');
    expect(out).toContain('B:');
  });

  it('preserves the headers of a header-only table (never dropped)', () => {
    const out = renderRecords(extractTable(tableNode('| Q1 | Q2 | Q3 |\n|---|---|---|'), ctx()));
    expect(out).toContain('Q1');
    expect(out).toContain('Q2');
    expect(out).toContain('Q3');
  });

  it('shows a blank first cell as a label, not as the record title', () => {
    const out = renderRecords(
      extractTable(tableNode('| Name | Email |\n|---|---|\n|  | a@x.com |'), ctx()),
    );
    expect(out).toContain('Name:');
    expect(out).toContain('Email: a@x.com');
  });
});

describe('chooseAutoLayout (three tiers)', () => {
  it('picks aligned for a genuinely compact table (plain / slack)', () => {
    const model = extractTable(tableNode(COMPACT), ctx());
    expect(chooseAutoLayout(model, 'plain')).toBe('aligned');
    expect(chooseAutoLayout(model, 'slack')).toBe('aligned');
  });

  it('picks wrapped for a moderately wide table (few enough columns)', () => {
    const model = extractTable(tableNode(WIDE_3), ctx());
    expect(chooseAutoLayout(model, 'plain')).toBe('wrapped');
    expect(chooseAutoLayout(model, 'slack')).toBe('wrapped');
  });

  it('picks records for a table with too many columns to wrap usefully', () => {
    const model = extractTable(tableNode(WIDE), ctx()); // 6 columns
    expect(chooseAutoLayout(model, 'plain')).toBe('records');
    expect(chooseAutoLayout(model, 'slack')).toBe('records');
  });

  it('always picks records for LinkedIn, even when compact', () => {
    const model = extractTable(tableNode(COMPACT), ctx());
    expect(chooseAutoLayout(model, 'linkedin')).toBe('records');
  });

  it('is deterministic (independent of any viewport)', () => {
    const model = extractTable(tableNode(WIDE_3), ctx());
    expect(chooseAutoLayout(model, 'plain')).toBe(chooseAutoLayout(model, 'plain'));
  });
});

describe('resolveLayout (manual override)', () => {
  it('honours an explicit aligned choice with wrapping — never demotes wide to records', () => {
    const wide = extractTable(tableNode(WIDE), ctx()); // 6 columns, would auto → records
    expect(resolveLayout(wide, 'plain', 'aligned')).toBe('wrapped');
    const compact = extractTable(tableNode(COMPACT), ctx());
    expect(resolveLayout(compact, 'plain', 'aligned')).toBe('aligned');
  });

  it('honours an explicit records choice', () => {
    const compact = extractTable(tableNode(COMPACT), ctx());
    expect(resolveLayout(compact, 'plain', 'records')).toBe('records');
  });

  it('defers to the auto heuristic when asked for auto', () => {
    expect(resolveLayout(extractTable(tableNode(COMPACT), ctx()), 'plain', 'auto')).toBe('aligned');
    expect(resolveLayout(extractTable(tableNode(WIDE_3), ctx()), 'plain', 'auto')).toBe('wrapped');
  });
});

describe('columnWidths', () => {
  it('is the max of header and body cell widths per column', () => {
    const widths = columnWidths(extractTable(tableNode(COMPACT), ctx()));
    expect(widths).toEqual([6, 4, 6]); // Option / Cost / Rating dominate
  });
});
