import { describe, expect, it } from 'vitest';
import {
  countLines,
  countWords,
  documentSentences,
  firstWord,
  normalizeForMatch,
  splitParagraphs,
  splitSentences,
} from './text';

describe('countWords', () => {
  it('counts word-like tokens and ignores punctuation runs', () => {
    expect(countWords('hello world')).toBe(2);
    expect(countWords('one, two — three!')).toBe(3);
    expect(countWords('   ')).toBe(0);
    expect(countWords("don't stop")).toBe(2);
  });
});

describe('countLines', () => {
  it('treats LF, CR, and CRLF each as one break', () => {
    expect(countLines('a\r\nb\nc\rd')).toBe(4);
    expect(countLines('single')).toBe(1);
    expect(countLines('')).toBe(0);
  });
});

describe('normalizeForMatch', () => {
  it('straightens curly quotes without changing length or other characters', () => {
    const input = 'He said “here’s” fine.';
    const out = normalizeForMatch(input);
    expect(out).toBe('He said "here\'s" fine.');
    expect(out.length).toBe(input.length);
  });
});

describe('splitParagraphs', () => {
  it('splits on blank lines and preserves offsets into the original text', () => {
    const text = 'First para.\n\nSecond para here.';
    const paras = splitParagraphs(text);
    expect(paras).toHaveLength(2);
    for (const p of paras) {
      expect(text.slice(p.start, p.end)).toBe(p.text);
    }
    expect(paras[1]!.text).toBe('Second para here.');
  });

  it('treats a single wall of prose as one paragraph', () => {
    const paras = splitParagraphs('one line\nstill same paragraph\nno blank line');
    expect(paras).toHaveLength(1);
  });
});

describe('splitSentences', () => {
  it('does not split on common abbreviations or decimals', () => {
    expect(splitSentences('Dr. Smith went home. He slept.')).toHaveLength(2);
    expect(splitSentences('Pi is 3.14 exactly. Yes.')).toHaveLength(2);
    expect(splitSentences('Meet at 5 p.m. today. Bring notes.')).toHaveLength(2);
  });

  it('splits on ?, !, and ellipses', () => {
    const s = splitSentences('Wait... really? Yes!');
    expect(s.map((x) => x.text)).toEqual(['Wait...', 'really?', 'Yes!']);
  });

  it('records word counts and offsets relative to the block start', () => {
    const s = splitSentences('Hello there. Go now.', 100);
    expect(s[0]).toMatchObject({ wordCount: 2, start: 100 });
    expect(s[1]!.wordCount).toBe(2);
  });
});

describe('documentSentences', () => {
  it('walks every paragraph in document order', () => {
    const text = 'A. B.\n\nC. D. E.';
    const sentences = documentSentences(splitParagraphs(text));
    expect(sentences).toHaveLength(5);
    for (const s of sentences) {
      expect(text.slice(s.start, s.end)).toBe(s.text);
    }
  });
});

describe('firstWord', () => {
  it('returns the lowercased first token', () => {
    expect(firstWord('  This is fine.')).toBe('this');
    expect(firstWord('"Quoted" start')).toBe('quoted');
    expect(firstWord('')).toBe('');
  });
});
