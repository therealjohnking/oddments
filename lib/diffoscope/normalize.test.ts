import { describe, expect, it } from 'vitest';
import { diffInMode } from './compare';
import {
  collapseWhitespace,
  foldConfusables,
  foldHomoglyphs,
  foldTypographicPunctuation,
  isStrippableInvisible,
  lensKey,
  stripInvisibles,
} from './normalize';
import { EXACT_LENS, type LensState } from './types';

const cp = (n: number) => String.fromCodePoint(n);
const lens = (over: Partial<LensState>): LensState => ({ ...EXACT_LENS, ...over });

describe('whole-string normalizers', () => {
  it('collapseWhitespace unifies spacing and line endings', () => {
    expect(collapseWhitespace('a\r\n  b\tc  ')).toBe('a b c');
    expect(collapseWhitespace(`a${cp(0x00a0)}b`)).toBe('a b'); // NBSP counts as whitespace
  });

  it('collapseWhitespace does NOT treat the BOM as whitespace (stripInvisibles owns it)', () => {
    // JS \s matches U+FEFF, but the BOM is an invisible format char, not whitespace.
    expect(collapseWhitespace(`a${cp(0xfeff)}b`)).toBe(`a${cp(0xfeff)}b`);
  });

  it('foldHomoglyphs folds only look-alike letters; foldTypographicPunctuation only punctuation', () => {
    const cyrillicA = cp(0x0430); // looks like 'a'
    const curly = cp(0x2019); // looks like "'"
    expect(foldHomoglyphs(`c${cyrillicA}t`)).toBe('cat');
    expect(foldHomoglyphs(`it${curly}s`)).toBe(`it${curly}s`); // punctuation untouched
    expect(foldTypographicPunctuation(`it${curly}s`)).toBe("it's");
    expect(foldTypographicPunctuation(`c${cyrillicA}t`)).toBe(`c${cyrillicA}t`); // letters untouched
  });

  it('foldConfusables maps look-alikes onto ASCII but leaves plain text alone', () => {
    expect(foldConfusables(`it${cp(0x2019)}s`)).toBe("it's"); // curly → straight
    expect(foldConfusables(`a${cp(0x2014)}b`)).toBe('a-b'); // em dash → hyphen
    expect(foldConfusables('plain ascii')).toBe('plain ascii');
  });

  it('stripInvisibles removes zero-width and format characters only', () => {
    expect(stripInvisibles(`a${cp(0x200b)}b`)).toBe('ab'); // ZWSP
    expect(stripInvisibles(`a${cp(0x00ad)}b`)).toBe('ab'); // soft hyphen
    expect(stripInvisibles(`a${cp(0x00a0)}b`)).toBe(`a${cp(0x00a0)}b`); // NBSP kept (visible space)
  });

  it('classifies strippable invisibles', () => {
    expect(isStrippableInvisible(0x200b)).toBe(true); // ZWSP
    expect(isStrippableInvisible(0x200d)).toBe(true); // ZWJ
    expect(isStrippableInvisible(0x0041)).toBe(false); // 'A'
    expect(isStrippableInvisible(0x00a0)).toBe(false); // NBSP is whitespace, not invisible
  });
});

describe('lensKey', () => {
  it('lowercases only when ignoreCase is set', () => {
    const token = { value: 'Hello', start: 0, kind: 'word' as const };
    expect(lensKey(token, EXACT_LENS)).toBe('Hello');
    expect(lensKey(token, lens({ ignoreCase: true }))).toBe('hello');
  });

  it('collapses a line token under ignoreWhitespace', () => {
    const token = { value: '  a   b  ', start: 0, kind: 'line' as const };
    expect(lensKey(token, lens({ ignoreWhitespace: true }))).toBe('a b');
  });

  it('maps a space token to a single space under ignoreWhitespace', () => {
    const token = { value: '\t  ', start: 0, kind: 'space' as const };
    expect(lensKey(token, lens({ ignoreWhitespace: true }))).toBe(' ');
  });
});

describe('lenses via diffInMode', () => {
  it('ignoreCase makes case-only differences equal without altering the sources', () => {
    const a = 'Hello World';
    const b = 'hello world';
    expect(diffInMode(a, b, 'word', EXACT_LENS).equal).toBe(false);
    expect(diffInMode(a, b, 'word', lens({ ignoreCase: true })).equal).toBe(true);
    // Sources are untouched.
    expect(a).toBe('Hello World');
    expect(b).toBe('hello world');
  });

  it('ignoreWhitespace makes spacing-only differences equal', () => {
    expect(diffInMode('a  b', 'a b', 'word', lens({ ignoreWhitespace: true })).equal).toBe(true);
    expect(diffInMode('a\tb', 'a b', 'line', lens({ ignoreWhitespace: true })).equal).toBe(true);
  });

  it('nfc makes precomposed vs decomposed accents equal in word mode', () => {
    const precomposed = `Caf${cp(0x00e9)}`;
    const decomposed = `Cafe${cp(0x0301)}`;
    expect(diffInMode(precomposed, decomposed, 'word', EXACT_LENS).equal).toBe(false);
    expect(diffInMode(precomposed, decomposed, 'word', lens({ nfc: true })).equal).toBe(true);
  });

  it('the displayed text stays original even under a lens', () => {
    const d = diffInMode('Hello', 'HELLO', 'char', lens({ ignoreCase: true }), { forceChar: true });
    // Equal under the lens, and the shown text is A's original casing.
    expect(d.equal).toBe(true);
    expect(d.segments.map((s) => s.value).join('')).toBe('Hello');
  });
});
