import { describe, expect, it } from 'vitest';
import { classify } from './classify';

describe('classify — structural and ordinary characters', () => {
  it('returns null for the structural whitespace it does not own', () => {
    expect(classify(0x20)).toBeNull(); // space
    expect(classify(0x09)).toBeNull(); // tab
    expect(classify(0x0a)).toBeNull(); // LF
    expect(classify(0x0d)).toBeNull(); // CR
  });

  it('returns null for ordinary printable characters', () => {
    expect(classify(0x41)).toBeNull(); // A
    expect(classify(0x7a)).toBeNull(); // z
    expect(classify(0x39)).toBeNull(); // 9
    expect(classify(0x2d)).toBeNull(); // ASCII hyphen-minus
    expect(classify(0x27)).toBeNull(); // ASCII apostrophe
    expect(classify(0xe9)).toBeNull(); // é (precomposed letter)
  });
});

describe('classify — named characters', () => {
  it('names unusual spaces', () => {
    expect(classify(0x00a0)).toMatchObject({
      category: 'unusual-space',
      name: 'No-break space',
      abbr: 'NBSP',
    });
    expect(classify(0x3000)?.category).toBe('unusual-space');
  });

  it('names zero-width characters', () => {
    expect(classify(0x200b)).toMatchObject({ category: 'zero-width', abbr: 'ZWSP' });
    expect(classify(0x200d)).toMatchObject({ category: 'zero-width', abbr: 'ZWJ' });
    expect(classify(0x2060)?.abbr).toBe('WJ');
  });

  it('names bidi controls with the right abbreviation', () => {
    expect(classify(0x202e)).toMatchObject({ category: 'bidi', abbr: 'RLO' });
    expect(classify(0x200f)).toMatchObject({ category: 'bidi', abbr: 'RLM' });
  });

  it('classifies soft hyphen and variation selectors', () => {
    expect(classify(0x00ad)?.category).toBe('soft-hyphen');
    expect(classify(0xfe0f)).toMatchObject({ category: 'variation-selector', abbr: 'VS16' });
  });

  it('classifies confusables with a looks-like hint', () => {
    expect(classify(0x2014)).toMatchObject({ category: 'confusable-dash', looksLike: '-' });
    expect(classify(0x2019)).toMatchObject({ category: 'confusable-quote', looksLike: "'" });
    expect(classify(0x0430)).toMatchObject({ category: 'confusable-letter', looksLike: 'a' });
    expect(classify(0x037e)).toMatchObject({ category: 'confusable-punctuation', looksLike: ';' });
  });
});

describe('classify — property-driven fallback (no hardcoded entry)', () => {
  it('catches the Arabic number-sign format controls via \\p{Cf}', () => {
    // U+0605 ARABIC NUMBER MARK ABOVE is not in the curated table.
    expect(classify(0x0605)?.category).toBe('zero-width');
    expect(classify(0x06dd)?.category).toBe('zero-width'); // ARABIC END OF AYAH
  });

  it('classifies tag characters and control codes', () => {
    expect(classify(0xe0041)?.category).toBe('tag');
    expect(classify(0x0007)).toMatchObject({ category: 'control', abbr: '^G' });
    expect(classify(0x009f)?.category).toBe('control'); // C1 control
  });

  it('classifies noncharacters and private-use code points', () => {
    expect(classify(0xfdd0)?.category).toBe('noncharacter');
    expect(classify(0xffff)?.category).toBe('noncharacter');
    expect(classify(0xe000)?.category).toBe('private-use');
  });

  it('classifies vertical / separator whitespace', () => {
    expect(classify(0x000b)?.category).toBe('vertical-whitespace'); // vertical tab
    expect(classify(0x2028)?.category).toBe('vertical-whitespace'); // line separator
    expect(classify(0x0085)?.category).toBe('vertical-whitespace'); // NEL
  });

  it('flags unpaired surrogates', () => {
    expect(classify(0xd800)).toMatchObject({ category: 'control', name: 'Unpaired surrogate' });
  });
});

describe('classify — fullwidth ASCII forms', () => {
  it('maps fullwidth letters to homoglyph letters', () => {
    expect(classify(0xff21)).toMatchObject({ category: 'confusable-letter', looksLike: 'A' });
    expect(classify(0xff41)).toMatchObject({ category: 'confusable-letter', looksLike: 'a' });
  });

  it('maps fullwidth digits and punctuation to confusable punctuation', () => {
    expect(classify(0xff10)).toMatchObject({ category: 'confusable-punctuation', looksLike: '0' });
    expect(classify(0xff01)).toMatchObject({ category: 'confusable-punctuation', looksLike: '!' });
  });
});
