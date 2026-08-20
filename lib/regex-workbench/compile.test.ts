import { describe, expect, it } from 'vitest';
import { compilePattern, parseLiteral } from './compile';

describe('compilePattern', () => {
  it('compiles a valid pattern and reports group metadata', () => {
    const result = compilePattern('(a)(b)', 'g');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags).toBe('g');
    expect(result.groupCount).toBe(2);
    expect(result.groupNames).toEqual([]);
    expect(result.groupNamesByNumber).toEqual([null, null]);
    // Execution flags gain `d` for capture-group positions.
    expect(result.execFlags).toContain('d');
    expect(result.execFlags).toContain('g');
  });

  it('collects named groups in order and maps them by number', () => {
    const result = compilePattern('(?<year>\\d{4})-(\\d{2})-(?<day>\\d{2})', '');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.groupCount).toBe(3);
    expect(result.groupNames).toEqual(['year', 'day']);
    expect(result.groupNamesByNumber).toEqual(['year', null, 'day']);
  });

  it('canonicalizes and dedupes flags', () => {
    const result = compilePattern('a', 'iggm');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.flags).toBe('gim');
  });

  it('reports an unmatched parenthesis without a stack trace', () => {
    const result = compilePattern('(a', '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).not.toMatch(/at |stack/i);
    expect(result.message.toLowerCase()).toContain('group');
  });

  it('reports an invalid quantifier', () => {
    const result = compilePattern('a{2,1}', '');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain('quantifier');
  });

  it('rejects an unknown flag with a clear message', () => {
    const result = compilePattern('a', 'z');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.toLowerCase()).toContain('flag');
  });

  it('rejects combining u and v', () => {
    const result = compilePattern('a', 'uv');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.hint?.toLowerCase()).toContain('mutually exclusive');
  });

  it('accepts Unicode mode with a property escape', () => {
    const result = compilePattern('\\p{Letter}+', 'u');
    expect(result.ok).toBe(true);
  });

  it('accepts v mode with a set intersection', () => {
    const result = compilePattern('[\\p{ASCII}&&\\p{L}]', 'v');
    expect(result.ok).toBe(true);
  });

  it('detects patterns that can match empty', () => {
    expect((compilePattern('a?', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(true);
    expect((compilePattern('(?=a)', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(true);
    expect((compilePattern('x*', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(true);
    expect((compilePattern('^$', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(true);
  });

  it('detects patterns that cannot match empty', () => {
    expect((compilePattern('abc', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(false);
    expect((compilePattern('\\d+', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(false);
    expect((compilePattern('\\bfoo', '') as { canMatchEmpty: boolean }).canMatchEmpty).toBe(false);
  });
});

describe('parseLiteral', () => {
  it('parses a /body/flags literal', () => {
    expect(parseLiteral('/foo\\s+bar/gi')).toEqual({ body: 'foo\\s+bar', flags: 'gi' });
  });

  it('keeps an escaped slash in the body and finds the real closing slash', () => {
    expect(parseLiteral('/a\\/b/')).toEqual({ body: 'a\\/b', flags: '' });
  });

  it('returns null for non-literal input', () => {
    expect(parseLiteral('foo')).toBeNull();
    expect(parseLiteral('')).toBeNull();
    expect(parseLiteral('//')).toBeNull(); // empty body
    expect(parseLiteral('/a/x')).toBeNull(); // x is not a flag
  });

  it('canonicalizes the parsed flags', () => {
    expect(parseLiteral('/a/ig')?.flags).toBe('gi');
  });
});
