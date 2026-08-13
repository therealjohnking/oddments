import { describe, expect, it } from 'vitest';
import { delimiterName, detectLineBreakStyle, parseCsv } from './parse';

describe('parseCsv — well-formed input', () => {
  it('parses a normal CSV with a detected header', () => {
    const p = parseCsv(
      'name,age,city\nAda,36,London\nGrace,40,NYC\nAlan,41,Cambridge\nEdsger,50,Austin\n',
    );
    expect(p.hasHeader).toBe(true);
    expect(p.headerDetected).toBe(true);
    expect(p.header).toEqual(['name', 'age', 'city']);
    expect(p.rows).toHaveLength(4);
    expect(p.columnCount).toBe(3);
    expect(p.rowShapeIssues).toHaveLength(0);
    expect(p.blankRowIndexes).toHaveLength(0);
    expect(p.delimiter).toBe(',');
  });

  it('preserves commas inside quoted fields', () => {
    const p = parseCsv('name,note\n"Smith, John",hi\n"Doe, Jane",yo\n');
    expect(p.rows[0]).toEqual(['Smith, John', 'hi']);
    expect(p.rows[1]).toEqual(['Doe, Jane', 'yo']);
    expect(p.rowShapeIssues).toHaveLength(0);
  });

  it('preserves newlines inside quoted fields', () => {
    const p = parseCsv('name,note\n"multi\nline",x\n');
    expect(p.rows[0]).toEqual(['multi\nline', 'x']);
    expect(p.rows).toHaveLength(1);
  });

  it('unescapes doubled quotes', () => {
    const p = parseCsv('quote\n"She said ""hi"""\n');
    expect(p.rows[0]).toEqual(['She said "hi"']);
  });

  it('handles CRLF line endings', () => {
    const p = parseCsv('a,b\r\n1,2\r\n3,4\r\n');
    expect(p.lineBreakStyle).toBe('crlf');
    expect(p.rows).toHaveLength(2);
    expect(p.rows[1]).toEqual(['3', '4']);
  });

  it('detects and strips a leading BOM', () => {
    const p = parseCsv('﻿name,age\nAda,36\nGrace,40\nAlan,41\n');
    expect(p.bom).toBe(true);
    expect(p.header[0]).toBe('name');
  });

  it('does not invent a trailing row for a terminating newline', () => {
    const withNewline = parseCsv('a,b\n1,2\n3,4\n');
    const withoutNewline = parseCsv('a,b\n1,2\n3,4');
    expect(withNewline.rows).toHaveLength(withoutNewline.rows.length);
    expect(withNewline.rows).toHaveLength(2);
  });
});

describe('parseCsv — blank and ragged rows', () => {
  it('counts a blank line in the middle as a blank row (not a ragged one)', () => {
    const p = parseCsv('a,b\n1,2\n\n3,4\n');
    expect(p.blankRowIndexes).toContain(1);
    expect(p.rowShapeIssues).toHaveLength(0);
  });

  it('flags rows with too few or too many fields', () => {
    const p = parseCsv('a,b,c\n1,2,3\n4,5\n6,7,8,9\n');
    const rowsWithIssues = p.rowShapeIssues.map((i) => i.row).sort();
    expect(rowsWithIssues).toEqual([2, 3]);
    const tooFew = p.rowShapeIssues.find((i) => i.row === 2);
    expect(tooFew).toMatchObject({ fields: 2, expected: 3 });
    const tooMany = p.rowShapeIssues.find((i) => i.row === 3);
    expect(tooMany).toMatchObject({ fields: 4, expected: 3 });
  });
});

describe('parseCsv — delimiters', () => {
  it('auto-detects semicolons, tabs, and pipes', () => {
    expect(parseCsv('a;b;c\n1;2;3\n4;5;6\n').delimiter).toBe(';');
    expect(parseCsv('a\tb\tc\n1\t2\t3\n4\t5\t6\n').delimiter).toBe('\t');
    expect(parseCsv('a|b|c\n1|2|3\n4|5|6\n').delimiter).toBe('|');
  });

  it('names delimiters', () => {
    expect(delimiterName(',')).toBe('comma');
    expect(delimiterName(';')).toBe('semicolon');
    expect(delimiterName('\t')).toBe('tab');
    expect(delimiterName('|')).toBe('pipe');
  });
});

describe('parseCsv — headers', () => {
  it('preserves duplicate header names rather than renaming them', () => {
    const p = parseCsv('Amount,Amount,note\n1,2,x\n3,4,y\n5,6,z\n');
    expect(p.header).toEqual(['Amount', 'Amount', 'note']);
  });

  it('treats a header-only file as a header with no data rows', () => {
    const p = parseCsv('a,b,c\n');
    expect(p.hasHeader).toBe(true);
    expect(p.rows).toHaveLength(0);
    expect(p.columnCount).toBe(3);
  });

  it('synthesizes column names when the first row looks like data', () => {
    const p = parseCsv('1,2,3\n4,5,6\n7,8,9\n10,11,12\n');
    expect(p.hasHeader).toBe(false);
    expect(p.header).toEqual(['Column 1', 'Column 2', 'Column 3']);
    expect(p.rows).toHaveLength(4);
  });

  it('honors a forced header mode', () => {
    const forcedNone = parseCsv('name,age\nAda,36\nGrace,40\nAlan,41\n', {
      headerMode: 'no-header',
    });
    expect(forcedNone.hasHeader).toBe(false);
    expect(forcedNone.rows).toHaveLength(4);

    const forcedHeader = parseCsv('1,2,3\n4,5,6\n', { headerMode: 'header' });
    expect(forcedHeader.hasHeader).toBe(true);
    expect(forcedHeader.rows).toHaveLength(1);
  });
});

describe('parseCsv — malformed and edge input', () => {
  it('reports an unterminated quoted field', () => {
    const p = parseCsv('a,b\n"open,2\n3,4\n');
    expect(p.parseIssues.some((i) => i.kind === 'quotes')).toBe(true);
  });

  it('returns zero columns for empty input', () => {
    expect(parseCsv('').columnCount).toBe(0);
    expect(parseCsv('').rows).toHaveLength(0);
  });

  it('applies the row cap and records truncation', () => {
    const body = 'a,b\n' + Array.from({ length: 20 }, (_, i) => `${i},x`).join('\n') + '\n';
    const p = parseCsv(body, { maxRows: 5 });
    expect(p.truncated).toBe(true);
    expect(p.analyzedRows).toBe(5);
    expect(p.totalRows).toBe(20);
    expect(p.rows).toHaveLength(5);
  });
});

describe('detectLineBreakStyle', () => {
  it('classifies each convention', () => {
    expect(detectLineBreakStyle('a\nb')).toBe('lf');
    expect(detectLineBreakStyle('a\r\nb')).toBe('crlf');
    expect(detectLineBreakStyle('a\rb')).toBe('cr');
    expect(detectLineBreakStyle('a\r\nb\nc')).toBe('mixed');
    expect(detectLineBreakStyle('abc')).toBe('none');
  });
});
