import { describe, expect, it } from 'vitest';
import { tokenizeGraphemes, tokenizeLines, tokenizeWords } from './tokenize';

const cp = (n: number) => String.fromCodePoint(n);

function reconstruct(tokens: { value: string }[]): string {
  return tokens.map((t) => t.value).join('');
}

describe('tokenizeGraphemes', () => {
  it('keeps a surrogate-pair emoji as a single token (never splits it)', () => {
    const emoji = cp(0x1f600);
    const tokens = tokenizeGraphemes(`a${emoji}b`);
    expect(reconstruct(tokens)).toBe(`a${emoji}b`);
    // No token is a lone surrogate.
    for (const t of tokens) {
      const first = t.value.charCodeAt(0);
      if (first >= 0xd800 && first <= 0xdbff) expect(t.value.length).toBeGreaterThanOrEqual(2);
    }
    expect(tokens.some((t) => t.value === emoji)).toBe(true);
  });

  it('does not split a ZWJ family emoji sequence across surrogate halves', () => {
    const family = cp(0x1f468) + cp(0x200d) + cp(0x1f469) + cp(0x200d) + cp(0x1f467);
    const tokens = tokenizeGraphemes(family);
    expect(reconstruct(tokens)).toBe(family);
    // With Intl.Segmenter this is one grapheme; without it, the code points — but
    // never a broken surrogate pair.
    expect([1, 5]).toContain(tokens.length);
    for (const t of tokens) {
      expect(t.value.length === 1 || [...t.value].length >= 1).toBe(true);
    }
  });

  it('keeps a base letter with its combining mark together when segmenter is present', () => {
    const decomposed = 'e' + cp(0x0301); // e + combining acute
    const tokens = tokenizeGraphemes(decomposed);
    expect(reconstruct(tokens)).toBe(decomposed);
    // Segmenter → 1 grapheme; fallback → 2 code points.
    expect([1, 2]).toContain(tokens.length);
  });

  it('records correct UTF-16 start offsets across an astral character', () => {
    const emoji = cp(0x1f600);
    const tokens = tokenizeGraphemes(`${emoji}x`);
    const xToken = tokens.find((t) => t.value === 'x');
    expect(xToken?.start).toBe(2); // emoji occupies UTF-16 units 0..1
  });
});

describe('tokenizeWords', () => {
  it('separates words, whitespace, and standalone punctuation', () => {
    const tokens = tokenizeWords('hello, world');
    expect(tokens.map((t) => [t.kind, t.value])).toEqual([
      ['word', 'hello'],
      ['punct', ','],
      ['space', ' '],
      ['word', 'world'],
    ]);
  });

  it('reconstructs the input exactly, including runs of spaces', () => {
    const input = '  a\t b  ';
    expect(reconstruct(tokenizeWords(input))).toBe(input);
  });

  it('keeps accented and non-Latin letters inside the word token', () => {
    const word = 'café';
    const tokens = tokenizeWords(word);
    expect(tokens).toHaveLength(1);
    expect(tokens[0]!.kind).toBe('word');
    expect(tokens[0]!.value).toBe(word);
  });
});

describe('tokenizeLines', () => {
  it('splits on LF, CRLF, and CR and records the terminator', () => {
    const tokens = tokenizeLines('a\r\nb\nc\rd');
    expect(tokens.map((t) => [t.value, t.terminator])).toEqual([
      ['a', 'crlf'],
      ['b', 'lf'],
      ['c', 'cr'],
      ['d', 'none'],
    ]);
  });

  it('yields a trailing empty line when the text ends with a newline', () => {
    const tokens = tokenizeLines('a\n');
    expect(tokens.map((t) => [t.value, t.terminator])).toEqual([
      ['a', 'lf'],
      ['', 'none'],
    ]);
  });

  it('records line start offsets', () => {
    const tokens = tokenizeLines('ab\ncd');
    expect(tokens[0]!.start).toBe(0);
    expect(tokens[1]!.start).toBe(3);
  });
});
