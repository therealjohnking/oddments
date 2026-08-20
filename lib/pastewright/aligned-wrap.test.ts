import { describe, expect, it } from 'vitest';
import type { Table } from 'mdast';
import { parseMarkdown } from './parse';
import { emptyStats } from './types';
import { PLAIN_POLICIES } from './profiles';
import type { InlineCtx } from './inline';
import { extractTable, renderAligned, ALIGNED_TARGET_WIDTH, type TableModel } from './tables';
import { displayWidth } from './width';

function ctx(): InlineCtx {
  return { policy: PLAIN_POLICIES.plain, stats: emptyStats(), defs: new Map() };
}
function model(md: string): TableModel {
  const root = parseMarkdown(md);
  const table = root.children.find((n): n is Table => n.type === 'table');
  if (!table) throw new Error('no table parsed');
  return extractTable(table, ctx());
}
function lines(out: string): string[] {
  return out.split('\n');
}
/** Every word across all header + body cells, sorted (for content-fidelity checks). */
function cellWords(m: TableModel): string[] {
  const words: string[] = [];
  for (const h of m.header) words.push(...h.split(/\s+/).filter(Boolean));
  for (const row of m.rows)
    for (const cell of row) words.push(...cell.split(/\s+/).filter(Boolean));
  return words.sort();
}
/** Every word recovered from the rendered table (borders + divider stripped), sorted. */
function renderedWords(out: string): string[] {
  return lines(out)
    .filter((l) => !/^\|[-|]+\|$/.test(l)) // drop the header separator
    .flatMap((l) => l.split('|'))
    .flatMap((seg) => seg.trim().split(/\s+/))
    .filter(Boolean)
    .sort();
}

const NARROW = '| Option | Cost | Rating |\n|---|--:|--:|\n| A | $10 | 8 |\n| B | $20 | 9 |';
const ONE_LONG =
  '| Feature | Notes |\n|---|---|\n| Export | Send your data to a CSV or JSON file for backup and archival later |';
const MANY_LONG = [
  '| Feature | Description | Availability |',
  '|---|---|---|',
  '| Export | Send your data to a CSV or JSON file for backup and archival | Available on every plan including the free tier |',
].join('\n');

describe('aligned wrapping renderer', () => {
  it('needs no wrapping for a narrow table (one physical line per logical row)', () => {
    const out = renderAligned(model(NARROW));
    const ls = lines(out);
    // header + divider + 2 rows = 4 physical lines
    expect(ls).toHaveLength(4);
    expect(ls[0]).toBe('| Option | Cost | Rating |');
    const widths = new Set(ls.map((l) => displayWidth(l)));
    expect(widths.size).toBe(1); // all lines the same width
  });

  it('wraps long text in one cell across multiple physical lines', () => {
    const out = renderAligned(model(ONE_LONG));
    const ls = lines(out);
    // header + divider + a body row taller than one line
    expect(ls.length).toBeGreaterThan(3);
    for (const l of ls) {
      expect(l.startsWith('|')).toBe(true);
      expect(l.endsWith('|')).toBe(true);
    }
  });

  it('sets a logical row’s height from the tallest wrapped cell', () => {
    const out = renderAligned(model(MANY_LONG));
    // header(1) + divider(1) + one body row that occupies several physical lines
    expect(lines(out).length).toBeGreaterThan(4);
  });

  it('keeps continuation text under the correct cell (borders stay aligned)', () => {
    const out = renderAligned(model(MANY_LONG));
    const ls = lines(out).filter((l) => !/^\|[-|]+\|$/.test(l));
    // Pipes appear at identical columns on every content line → columns hold.
    const pipeCols = (l: string): number[] => {
      const cols: number[] = [];
      let acc = 0;
      for (const ch of l) {
        if (ch === '|') cols.push(acc);
        acc += displayWidth(ch);
      }
      return cols;
    };
    const first = pipeCols(ls[0]!);
    for (const l of ls) expect(pipeCols(l)).toEqual(first);
  });

  it('bounds every physical line to the target width', () => {
    const out = renderAligned(model(MANY_LONG));
    for (const l of lines(out)) expect(displayWidth(l)).toBeLessThanOrEqual(ALIGNED_TARGET_WIDTH);
  });

  it('hard-breaks a long unbroken token (URL) without destroying the layout', () => {
    const url = 'https://example.com/very/long/path/that/keeps/going/and/going/forever/index.html';
    const out = renderAligned(model(`| Name | Link |\n|---|---|\n| Docs | ${url} |`));
    for (const l of lines(out)) expect(displayWidth(l)).toBeLessThanOrEqual(ALIGNED_TARGET_WIDTH);
    // The URL survives intact once borders/whitespace are removed.
    expect(out.replace(/[|\s]/g, '')).toContain(url);
  });

  it('handles empty cells', () => {
    const out = renderAligned(model('| A | B |\n|---|---|\n|  | y |\n| x |  |'));
    expect(out).toContain('|   | y |');
    expect(out).toContain('| x |   |');
  });

  it('preserves Unicode without splitting surrogate pairs / graphemes', () => {
    const out = renderAligned(model('| E |\n|---|\n| 🚀🚀🚀 |'));
    expect((out.match(/🚀/g) ?? []).length).toBe(3); // no emoji lost or split
    const cjk = renderAligned(model('| 名前 | 説明 |\n|---|---|\n| 東京 | 日本の首都 |'));
    expect(cjk).toContain('日本の首都');
  });

  it('renders 3+ columns with the right number of cell separators', () => {
    const out = renderAligned(model('| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |'));
    // A 3-column bordered row has 4 pipes.
    expect((lines(out)[0]!.match(/\|/g) ?? []).length).toBe(4);
  });

  it('aligns a right-aligned column header within its cell', () => {
    const out = renderAligned(model('| Item | Amount |\n|---|--:|\n| A | 1000000 |'));
    expect(out).toContain('|  Amount |'); // "Amount" right-aligned in a width-7 column
    expect(out).toContain('| 1000000 |');
  });

  it('is deterministic', () => {
    expect(renderAligned(model(MANY_LONG))).toBe(renderAligned(model(MANY_LONG)));
  });

  it('preserves every cell’s words with none lost or duplicated', () => {
    for (const md of [NARROW, ONE_LONG, MANY_LONG]) {
      const m = model(md);
      expect(renderedWords(renderAligned(m))).toEqual(cellWords(m));
    }
  });
});
