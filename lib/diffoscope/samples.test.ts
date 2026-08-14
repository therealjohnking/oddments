import { describe, expect, it } from 'vitest';
import { analyzePair, diffInMode, toUnifiedDiff, EXACT_LENS } from './index';
import { EXAMPLES, FLAGSHIP_EXAMPLE } from './samples';

const byId = (id: string) => EXAMPLES.find((e) => e.id === id)!;
const hasSegmenter = typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function';

describe('examples', () => {
  it('exposes exactly the three curated examples', () => {
    expect(EXAMPLES.map((e) => e.id)).toEqual(['hidden', 'prose', 'config']);
    expect(FLAGSHIP_EXAMPLE.id).toBe('hidden');
  });

  it('flagship "looks identical" pair is cosmetic-only with rich findings', () => {
    const { a, b } = byId('hidden');
    const analysis = analyzePair(a, b);
    expect(analysis.exactlyEqual).toBe(false);
    expect(analysis.verdict.kind).toBe('cosmetic');

    const kinds = new Set(analysis.findings.map((f) => f.kind));
    expect(kinds.has('whitespace')).toBe(true); // NBSP + trailing spaces
    expect(kinds.has('invisible')).toBe(true); // zero-width space
    expect(kinds.has('punctuation')).toBe(true); // curly apostrophe + em dash
    expect(kinds.has('line-ending')).toBe(true); // LF vs CRLF
    if (hasSegmenter) expect(kinds.has('normalization')).toBe(true); // é precomposed vs combining
  });

  it('prose revision shows word-level inserts, deletes, and replaces', () => {
    const { a, b } = byId('prose');
    const d = diffInMode(a, b, 'word', EXACT_LENS);
    expect(d.equal).toBe(false);
    expect(d.inserted).toBeGreaterThan(0);
    expect(d.deleted).toBeGreaterThan(0);
    // "new" → "redesigned" is a clean word replacement.
    const ops = d.segments.map((s) => `${s.op}:${s.value}`);
    expect(ops).toContain('delete:new');
    expect(ops).toContain('insert:redesigned');
  });

  it('config change is a clean line diff with a usable unified patch', () => {
    const { a, b } = byId('config');
    const d = diffInMode(a, b, 'line', EXACT_LENS);
    expect(d.segments.some((s) => s.op === 'delete' && s.value === 'debug = false')).toBe(true);
    expect(d.segments.some((s) => s.op === 'insert' && s.value === 'debug = true')).toBe(true);
    expect(d.segments.some((s) => s.op === 'insert' && s.value === 'timeout = 30')).toBe(true);

    const patch = toUnifiedDiff(a, b);
    expect(patch).toContain('+debug = true');
    expect(patch).toContain('+timeout = 30');
    expect(patch).toContain('-debug = false');
  });
});
