import { describe, expect, it } from 'vitest';
import { compilePattern } from './compile';
import { executeRegex } from './execute';
import { enrichMatches } from './matches';
import type { MatchResult } from './types';

/** compile → execute → enrich, the real pipeline. */
function pipeline(source: string, flags: string, text: string): MatchResult {
  const compiled = compilePattern(source, flags);
  if (!compiled.ok) throw new Error('compile failed');
  const raw = executeRegex({ source, flags: compiled.execFlags, text, cap: 1000 });
  if (!raw.ok) throw new Error('exec failed');
  return enrichMatches(raw.matches, {
    text,
    groupNamesByNumber: compiled.groupNamesByNumber,
    global: flags.includes('g') || flags.includes('y'),
    truncated: raw.truncated,
    cap: 1000,
  });
}

describe('enrichMatches — positions', () => {
  it('reports UTF-16 offsets and 1-based line/column for ASCII', () => {
    const m = pipeline('c', '', 'abc').matches[0]!;
    expect(m).toMatchObject({ start: 2, end: 3, length: 1 });
    expect(m.startPos).toEqual({ line: 1, column: 3 });
  });

  it('counts columns in code points across an astral char before the match', () => {
    const m = pipeline('X', 'g', '😀X').matches[0]!;
    // 😀 is UTF-16 length 2 but one code point → X is at offset 2, column 2.
    expect(m.start).toBe(2);
    expect(m.startPos).toEqual({ line: 1, column: 2 });
  });

  it('locates matches on later lines (LF)', () => {
    const m = pipeline('c', '', 'ab\ncd').matches[0]!;
    expect(m.start).toBe(3);
    expect(m.startPos).toEqual({ line: 2, column: 1 });
  });

  it('treats CRLF as a single break', () => {
    const m = pipeline('b', '', 'a\r\nb').matches[0]!;
    expect(m.start).toBe(3);
    expect(m.startPos).toEqual({ line: 2, column: 1 });
  });
});

describe('enrichMatches — structure', () => {
  it('flags zero-width matches', () => {
    const m = pipeline('\\b', 'g', 'hi').matches[0]!;
    expect(m.empty).toBe(true);
    expect(m.length).toBe(0);
    expect(m.start).toBe(m.end);
  });

  it('assigns 1-based ordinals', () => {
    const ms = pipeline('a', 'g', 'aaa').matches;
    expect(ms.map((m) => m.ordinal)).toEqual([1, 2, 3]);
  });

  it('attaches group names and exposes a named-only view', () => {
    const m = pipeline('(?<year>\\d{4})-(\\d{2})', '', '2026-08').matches[0]!;
    expect(m.groups.map((g) => g.name)).toEqual(['year', null]);
    expect(m.namedGroups).toHaveLength(1);
    expect(m.namedGroups[0]).toMatchObject({ name: 'year', value: '2026' });
  });

  it('carries capture-group positions through enrichment', () => {
    const m = pipeline('(\\d{2})', 'g', 'x42').matches[0]!;
    const g = m.groups[0]!;
    expect(g).toMatchObject({ start: 1, end: 3, value: '42' });
    expect(g.startPos).toEqual({ line: 1, column: 2 });
  });
});
