import { describe, expect, it } from 'vitest';
import {
  countCodePoints,
  countGraphemes,
  fallbackAbbr,
  formatCodePoint,
  utf8ByteLength,
} from './format';

const cp = (n: number) => String.fromCodePoint(n);

describe('formatCodePoint', () => {
  it('pads to at least four hex digits and uppercases', () => {
    expect(formatCodePoint(0x200b)).toBe('U+200B');
    expect(formatCodePoint(0x41)).toBe('U+0041');
    expect(formatCodePoint(0x1f600)).toBe('U+1F600');
  });
});

describe('fallbackAbbr', () => {
  it('uses caret notation for C0 controls and DEL', () => {
    expect(fallbackAbbr(0x07)).toBe('^G');
    expect(fallbackAbbr(0x00)).toBe('^@');
    expect(fallbackAbbr(0x1b)).toBe('^[');
    expect(fallbackAbbr(0x7f)).toBe('^?');
  });

  it('falls back to a code point label otherwise', () => {
    expect(fallbackAbbr(0x2028)).toBe('U+2028');
  });
});

describe('countCodePoints', () => {
  it('counts astral characters as one', () => {
    expect(countCodePoints('abc')).toBe(3);
    expect(countCodePoints(cp(0x1f600))).toBe(1);
    expect(countCodePoints(cp(0x1f468) + cp(0x200d) + cp(0x1f469))).toBe(3);
  });

  it('counts a lone surrogate as one', () => {
    expect(countCodePoints('\ud800')).toBe(1);
  });
});

describe('countGraphemes', () => {
  it('groups a ZWJ emoji sequence into a single grapheme when supported', () => {
    const family = cp(0x1f468) + cp(0x200d) + cp(0x1f469) + cp(0x200d) + cp(0x1f467);
    // Intl.Segmenter yields 1; the fallback (no Segmenter) yields the 5 code points.
    expect([1, 5]).toContain(countGraphemes(family));
  });
});

describe('utf8ByteLength', () => {
  it('matches UTF-8 encoding sizes', () => {
    expect(utf8ByteLength('a')).toBe(1);
    expect(utf8ByteLength(cp(0x00a0))).toBe(2);
    expect(utf8ByteLength(cp(0x20ac))).toBe(3);
    expect(utf8ByteLength(cp(0x1f600))).toBe(4);
  });
});
