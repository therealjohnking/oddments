import { describe, expect, it } from 'vitest';
import {
  PIPELINE_ORDER,
  TRANSFORMS,
  applyTransforms,
  defaultEnabledTransforms,
  type TransformId,
} from './clean';

const cp = (n: number) => String.fromCodePoint(n);
const only = (...ids: TransformId[]) => new Set<TransformId>(ids);
const apply = (text: string, ...ids: TransformId[]) => applyTransforms(text, only(...ids)).text;

describe('default transforms', () => {
  it('enables only the two safe transforms by default', () => {
    const defaults = defaultEnabledTransforms();
    expect([...defaults].sort()).toEqual(['normalize-line-endings', 'strip-trailing-whitespace']);
  });

  it('normalizes line endings and strips trailing whitespace together', () => {
    expect(applyTransforms('a \r\nb  ', defaultEnabledTransforms()).text).toBe('a\nb');
  });

  it('is a no-op with no transforms enabled', () => {
    const input = `anything${cp(0x200b)}`;
    const result = applyTransforms(input, new Set());
    expect(result.changed).toBe(false);
    expect(result.text).toBe(input);
  });
});

describe('whitespace transforms', () => {
  it('converts no-break spaces but not other Unicode spaces', () => {
    const input = `a${cp(0x00a0)}b${cp(0x2003)}c`;
    expect(apply(input, 'normalize-nbsp')).toBe(`a b${cp(0x2003)}c`);
    expect(apply(input, 'normalize-unicode-spaces')).toBe(`a${cp(0x00a0)}b c`);
  });

  it('applies space normalization before trailing strip (pipeline order)', () => {
    // NBSP at end of line becomes a space, then trailing-strip removes it.
    const out = applyTransforms(
      `a${cp(0x00a0)}\n`,
      only('normalize-nbsp', 'strip-trailing-whitespace'),
    ).text;
    expect(out).toBe('a\n');
  });
});

describe('zero-width transforms', () => {
  it('removes zero-width spaces and word joiners but never ZWJ/ZWNJ', () => {
    const input = `a${cp(0x200b)}b${cp(0x2060)}c${cp(0x200d)}d`;
    expect(apply(input, 'remove-zero-width')).toBe(`abc${cp(0x200d)}d`);
  });

  it('removes interior BOM/ZWNBSP but preserves a leading BOM', () => {
    const input = `${cp(0xfeff)}a${cp(0xfeff)}b`;
    expect(apply(input, 'remove-zero-width')).toBe(`${cp(0xfeff)}ab`);
  });

  it('removes ZWJ/ZWNJ only with the dedicated destructive transform', () => {
    const input = `a${cp(0x200c)}b${cp(0x200d)}c`;
    expect(apply(input, 'remove-zwj-zwnj')).toBe('abc');
  });

  it('strips a leading BOM with strip-bom', () => {
    expect(apply(`${cp(0xfeff)}abc`, 'strip-bom')).toBe('abc');
    expect(TRANSFORMS['strip-bom'].count(`${cp(0xfeff)}abc`)).toBe(1);
    expect(TRANSFORMS['strip-bom'].count('abc')).toBe(0);
  });
});

describe('confusable transforms', () => {
  it('converts curly quotes to straight quotes', () => {
    const input = `${cp(0x201c)}x${cp(0x201d)} ${cp(0x2018)}y${cp(0x2019)}`;
    expect(apply(input, 'smart-quotes')).toBe(`"x" 'y'`);
  });

  it('converts dashes to a hyphen', () => {
    const input = cp(0x2014) + cp(0x2013) + cp(0x2212);
    expect(apply(input, 'dashes-to-hyphen')).toBe('---');
  });
});

describe('control / bidi / normalization transforms', () => {
  it('removes control characters but keeps tab and newline', () => {
    const input = `a${cp(0x0007)}b\tc\nd`;
    expect(apply(input, 'remove-controls')).toBe('ab\tc\nd');
  });

  it('removes bidi controls', () => {
    const input = `a${cp(0x202e)}b${cp(0x202c)}c`;
    expect(apply(input, 'remove-bidi')).toBe('abc');
  });

  it('applies NFC normalization', () => {
    const decomposed = `e${cp(0x0301)}`; // e + combining acute accent
    const result = applyTransforms(decomposed, only('nfc-normalize'));
    expect(result.text).toBe(cp(0x00e9)); // é
    expect(TRANSFORMS['nfc-normalize'].count(decomposed)).toBeGreaterThan(0);
  });
});

describe('transform invariants', () => {
  it('every transform is idempotent', () => {
    const sample =
      `${cp(0xfeff)}a ${cp(0x00a0)}${cp(0x200b)}${cp(0x2014)}${cp(0x201c)}x${cp(0x201d)}` +
      `${cp(0x202e)}y${cp(0x202c)}${cp(0x00ad)}\t  \r\n`;
    for (const id of PIPELINE_ORDER) {
      const once = TRANSFORMS[id].apply(sample);
      const twice = TRANSFORMS[id].apply(once);
      expect(twice, `${id} should be idempotent`).toBe(once);
    }
  });

  it('reports negative code-point delta when characters are removed', () => {
    const result = applyTransforms(`a${cp(0x200b)}${cp(0x200b)}b`, only('remove-zero-width'));
    expect(result.codePointDelta).toBe(-2);
    expect(result.changed).toBe(true);
  });
});
