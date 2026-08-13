import { describe, expect, it } from 'vitest';
import {
  classifyCell,
  classifyValue,
  isBooleanColumnShape,
  parseDateLike,
  parseNumericLike,
  resolveDominantType,
} from './infer';
import type { TypeBreakdown } from './types';

function breakdown(partial: Partial<TypeBreakdown>): TypeBreakdown {
  return { integer: 0, decimal: 0, boolean: 0, date: 0, datetime: 0, text: 0, ...partial };
}

describe('classifyValue — numbers', () => {
  it('recognizes integers and decimals', () => {
    expect(classifyValue('42')).toBe('integer');
    expect(classifyValue('-42')).toBe('integer');
    expect(classifyValue('+7')).toBe('integer');
    expect(classifyValue('3.14')).toBe('decimal');
    expect(classifyValue('.5')).toBe('decimal');
    expect(classifyValue('1e3')).toBe('decimal');
  });

  it('accepts conservative formatted numbers', () => {
    expect(classifyValue('1,000')).toBe('integer');
    expect(classifyValue('1,000.50')).toBe('decimal');
    expect(classifyValue('$85,000')).toBe('integer');
    expect(classifyValue('45%')).toBe('decimal');
  });

  it('rejects malformed numbers as text', () => {
    expect(classifyValue('1,00')).toBe('text');
    expect(classifyValue('12.34.56')).toBe('text');
    expect(classifyValue('8O000')).toBe('text');
    expect(classifyValue('12abc')).toBe('text');
  });
});

describe('classifyValue — booleans, dates, text', () => {
  it('recognizes boolean tokens but not lone 0/1', () => {
    for (const t of ['true', 'false', 'yes', 'no', 'YES', 'No']) {
      expect(classifyValue(t)).toBe('boolean');
    }
    expect(classifyValue('1')).toBe('integer');
    expect(classifyValue('0')).toBe('integer');
    expect(classifyValue('y')).toBe('text');
  });

  it('recognizes only unambiguous dates', () => {
    expect(classifyValue('2026-08-13')).toBe('date');
    expect(classifyValue('2026/08/13')).toBe('date');
    expect(classifyValue('2026-08-13T10:30:00Z')).toBe('datetime');
    expect(classifyValue('2026-08-13 10:30')).toBe('datetime');
  });

  it('leaves ambiguous or impossible dates as text', () => {
    expect(classifyValue('08/13/2026')).toBe('text');
    expect(classifyValue('13-08-2026')).toBe('text');
    expect(classifyValue('2026-02-30')).toBe('text');
    expect(classifyValue('2026-13-01')).toBe('text');
  });
});

describe('classifyCell — blank kinds', () => {
  it('separates empty, whitespace, and null-like from real values', () => {
    expect(classifyCell('')).toBe('empty');
    expect(classifyCell('   ')).toBe('whitespace');
    expect(classifyCell('\t')).toBe('whitespace');
    expect(classifyCell('NULL')).toBe('null-like');
    expect(classifyCell('N/A')).toBe('null-like');
    expect(classifyCell('-')).toBe('null-like');
    expect(classifyCell('None')).toBe('null-like');
  });

  it('does not treat ambiguous values as null', () => {
    expect(classifyCell('0')).toBe('integer');
    expect(classifyCell('No')).toBe('boolean');
    expect(classifyCell('Unknown')).toBe('text');
  });
});

describe('parseNumericLike', () => {
  it('reports integer vs decimal and formatting', () => {
    expect(parseNumericLike('42')).toEqual({ value: 42, isInteger: true, formatted: false });
    expect(parseNumericLike('$1,200.50')).toEqual({
      value: 1200.5,
      isInteger: false,
      formatted: true,
    });
    expect(parseNumericLike('50%')).toEqual({ value: 50, isInteger: false, formatted: true });
    expect(parseNumericLike('nope')).toBeNull();
  });
});

describe('parseDateLike', () => {
  it('validates real calendar dates', () => {
    expect(parseDateLike('2020-02-29')).not.toBeNull(); // leap year
    expect(parseDateLike('2021-02-29')).toBeNull(); // not a leap year
  });

  it('orders instants and flags time components', () => {
    const early = parseDateLike('2020-01-01');
    const late = parseDateLike('2020-12-31');
    expect(early!.time).toBeLessThan(late!.time);
    expect(parseDateLike('2020-01-01')!.hasTime).toBe(false);
    expect(parseDateLike('2020-01-01T12:00:00Z')!.hasTime).toBe(true);
  });
});

describe('resolveDominantType', () => {
  it('picks a concrete type when one family dominates', () => {
    expect(resolveDominantType(breakdown({ integer: 10 }), 10, false).type).toBe('integer');
    expect(resolveDominantType(breakdown({ integer: 4, decimal: 6 }), 10, false).type).toBe(
      'decimal',
    );
    expect(resolveDominantType(breakdown({ date: 8, datetime: 2 }), 10, false).type).toBe(
      'datetime',
    );
  });

  it('keeps the dominant type and reports conformity when a few values differ', () => {
    const result = resolveDominantType(breakdown({ integer: 99, text: 1 }), 100, false);
    expect(result.type).toBe('integer');
    expect(result.conformity).toBeCloseTo(0.99, 5);
  });

  it('falls back to text or mixed when no family dominates', () => {
    expect(resolveDominantType(breakdown({ text: 9, integer: 1 }), 10, false).type).toBe('text');
    expect(resolveDominantType(breakdown({ integer: 5, text: 5 }), 10, false).type).toBe('mixed');
    expect(resolveDominantType(breakdown({}), 0, false).type).toBe('empty');
  });

  it('honors a boolean-shape override', () => {
    expect(resolveDominantType(breakdown({ text: 10 }), 10, true).type).toBe('boolean');
  });
});

describe('isBooleanColumnShape', () => {
  it('accepts two-token boolean vocabularies', () => {
    expect(isBooleanColumnShape(new Set(['yes', 'no']))).toBe(true);
    expect(isBooleanColumnShape(new Set(['true', 'false']))).toBe(true);
    expect(isBooleanColumnShape(new Set(['0', '1']))).toBe(true);
    expect(isBooleanColumnShape(new Set(['y', 'n']))).toBe(true);
  });

  it('rejects non-boolean or single-token sets', () => {
    expect(isBooleanColumnShape(new Set(['yes']))).toBe(false);
    expect(isBooleanColumnShape(new Set(['active', 'inactive']))).toBe(false);
    expect(isBooleanColumnShape(new Set(['yes', 'no', 'maybe']))).toBe(false);
  });
});
