import { describe, expect, it } from 'vitest';
import { transform } from './transform';
import { EXAMPLES } from './examples';
import type { Destination } from './types';

const ALL: Destination[] = ['rich', 'linkedin', 'slack', 'reddit', 'plain'];
const vendor = EXAMPLES.find((e) => e.id === 'vendor-comparison')!.markdown;

describe('transform: shape and safety of the result', () => {
  it('handles empty input for every destination without throwing', () => {
    for (const dest of ALL) {
      const r = transform('', dest);
      expect(r.text).toBe('');
      expect(r.findings).toEqual([]);
      expect(r.status.kind).toBe('preserved');
      expect(r.tableCount).toBe(0);
      expect(r.showTableControl).toBe(false);
    }
  });

  it('provides html + rich only for the rich destination', () => {
    expect(transform('# a', 'rich').html).toBeTruthy();
    expect(transform('# a', 'rich').rich).toBeTruthy();
    for (const dest of ['linkedin', 'slack', 'reddit', 'plain'] as const) {
      expect(transform('# a', dest).html).toBeNull();
      expect(transform('# a', dest).rich).toBeNull();
    }
  });

  it('counts characters as code points of the produced text', () => {
    const r = transform('# héllo 🙂', 'plain');
    expect(r.charCount).toBe(Array.from(r.text).length);
  });

  it('is deterministic — identical inputs give identical output', () => {
    for (const dest of ALL) {
      expect(transform(vendor, dest, 'auto')).toEqual(transform(vendor, dest, 'auto'));
    }
  });
});

describe('transform: destinations differ meaningfully', () => {
  it('renders the same table five recognisably different ways', () => {
    expect(transform(vendor, 'rich').html).toContain('<table>');
    expect(transform(vendor, 'reddit').text).toMatch(/\|\s*Vendor/);
    expect(transform(vendor, 'linkedin').text).toContain('Vendor Atlas'); // record layout
    expect(transform(vendor, 'plain').text).toContain('Vendor Atlas');
    // No two plain-family outputs are accidentally identical to the reddit table.
    expect(transform(vendor, 'plain').text).not.toEqual(transform(vendor, 'reddit').text);
  });

  it('shows the table-layout control only where aligned columns are usable', () => {
    expect(transform(vendor, 'plain').showTableControl).toBe(true);
    expect(transform(vendor, 'slack').showTableControl).toBe(true);
    // LinkedIn is records-only, so it offers no aligned/records choice.
    expect(transform(vendor, 'linkedin').showTableControl).toBe(false);
    expect(transform(vendor, 'rich').showTableControl).toBe(false);
    expect(transform(vendor, 'reddit').showTableControl).toBe(false);
    expect(transform('# no table', 'plain').showTableControl).toBe(false);
  });

  it('honours the manual table-layout override for the plain family', () => {
    const compact = '| A | B |\n|---|---|\n| 1 | 2 |';
    const aligned = transform(compact, 'plain', 'aligned').text;
    const records = transform(compact, 'plain', 'records').text;
    expect(aligned).not.toEqual(records);
    expect(records).toContain('A 1');
    expect(aligned.split('\n')[0]).toBe('| A | B |'); // bordered aligned table
    expect(aligned.split('\n')[1]).toBe('|---|---|'); // header separator
  });

  it('honours Aligned columns for a wide table by wrapping (not falling back to records)', () => {
    const wide =
      '| Feature | Description | Notes |\n|---|---|---|\n| Export | Send your data to a CSV or JSON file for backup and archival | Works offline |';
    const aligned = transform(wide, 'plain', 'aligned').text;
    // Bordered + wrapped: the single logical row spans 2+ physical lines, so with
    // the header row and separator the table has at least 4 physical lines.
    expect(aligned).toContain('|');
    expect(aligned.split('\n').length).toBeGreaterThanOrEqual(4);
    expect(aligned).not.toContain('Description: '); // it is NOT record layout
  });
});

describe('transform: content fidelity across destinations', () => {
  const cells = [
    'Vendor',
    'Setup',
    'Monthly',
    'Best for',
    'Main limitation',
    'Atlas',
    '$0',
    '$29',
    'Small teams getting started',
    'Limited data export',
    'Delta',
    '$79',
    'Sampling above 5M events',
  ];

  it('preserves every header and cell in each destination', () => {
    for (const dest of ALL) {
      const r = transform(vendor, dest);
      const haystack = dest === 'rich' ? r.html! : r.text;
      for (const cell of cells) {
        expect(haystack, `${cell} missing from ${dest}`).toContain(cell);
      }
    }
  });

  it('preserves image information (alt + url) rather than dropping it', () => {
    const md = '![Architecture diagram](https://e.com/a.png)';
    expect(transform(md, 'plain').text).toContain('Architecture diagram');
    expect(transform(md, 'plain').text).toContain('https://e.com/a.png');
    expect(transform(md, 'reddit').text).toContain('https://e.com/a.png');
    expect(transform(md, 'rich').html).toContain('https://e.com/a.png');
  });

  it('does not alter the author’s words (no summarising or reordering)', () => {
    const md = 'The quick brown fox jumps over the lazy dog. Second sentence stays put.';
    for (const dest of ['linkedin', 'slack', 'plain'] as const) {
      expect(transform(md, dest).text).toBe(md);
    }
  });
});

describe('transform: all built-in examples render for all destinations', () => {
  it('never throws and always produces some output for non-empty examples', () => {
    for (const example of EXAMPLES) {
      for (const dest of ALL) {
        const r = transform(example.markdown, dest);
        const produced = dest === 'rich' ? r.html! : r.text;
        expect(produced.length, `${example.id}/${dest}`).toBeGreaterThan(0);
      }
    }
  });
});
