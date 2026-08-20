import { describe, expect, it } from 'vitest';
import { escapeForLiteral, toConstructor, toRegexLiteral } from './export';

describe('escapeForLiteral', () => {
  it('escapes an unescaped forward slash', () => {
    expect(escapeForLiteral('foo/bar')).toBe('foo\\/bar');
  });

  it('leaves an already-escaped slash alone', () => {
    expect(escapeForLiteral('a\\/b')).toBe('a\\/b');
  });

  it('renders an empty body as (?:)', () => {
    expect(escapeForLiteral('')).toBe('(?:)');
  });

  it('does not disturb other escapes', () => {
    expect(escapeForLiteral('\\d+/\\w')).toBe('\\d+\\/\\w');
  });

  it('escapes raw line terminators so the literal never becomes invalid', () => {
    const u2028 = String.fromCharCode(0x2028);
    const u2029 = String.fromCharCode(0x2029);
    expect(escapeForLiteral('a\nb')).toBe('a\\nb');
    expect(escapeForLiteral('a\rb')).toBe('a\\rb');
    expect(escapeForLiteral(`a${u2028}b`)).toBe('a\\u2028b');
    expect(escapeForLiteral(`a${u2029}b`)).toBe('a\\u2029b');
  });

  it('produces a literal that is valid and equivalent to the source pattern', () => {
    const u2028 = String.fromCharCode(0x2028);
    for (const body of ['a\nb', 'a\rb', `a${u2028}b`, 'x/y', 'plain']) {
      const literal = escapeForLiteral(body);
      // The escaped body must form a compilable literal equivalent to the input.
      const rebuilt = new RegExp(literal);
      expect(rebuilt.source).toBe(new RegExp(body).source);
    }
  });
});

describe('toRegexLiteral', () => {
  it('wraps and appends flags', () => {
    expect(toRegexLiteral('a/b', 'gi')).toBe('/a\\/b/gi');
  });

  it('handles the empty pattern', () => {
    expect(toRegexLiteral('', 'g')).toBe('/(?:)/g');
  });
});

describe('toConstructor', () => {
  it('escapes backslashes and quotes for a JS string', () => {
    expect(toConstructor('\\d"x', 'g')).toBe('new RegExp("\\\\d\\"x", "g")');
  });

  it('omits the flags argument when there are none', () => {
    expect(toConstructor('abc', '')).toBe('new RegExp("abc")');
  });

  it('does not need to escape forward slashes', () => {
    expect(toConstructor('a/b', '')).toBe('new RegExp("a/b")');
  });
});
