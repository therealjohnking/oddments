import { describe, expect, it } from 'vitest';
import { analyzeJson, SAMPLE_JSON } from './index';

describe('built-in sample', () => {
  const analysis = analyzeJson(SAMPLE_JSON);
  if (analysis.status !== 'ok') throw new Error(`sample did not parse: ${analysis.status}`);
  const ids = analysis.findings.map((f) => f.id);

  it('is valid JSON with an object root', () => {
    expect(analysis.profile.rootKind).toBe('object');
  });

  it('surfaces the duplicate config key', () => {
    expect(ids).toContain('dup-keys');
    expect(analysis.hasDuplicateKeys).toBe(true);
  });

  it('surfaces the unsafe integer (retryLimit)', () => {
    expect(ids).toContain('numbers-unsafe');
  });

  it('surfaces the case-only key collision (customerId / customerID)', () => {
    expect(ids).toContain('keys-case');
  });

  it('surfaces the mixed-type tags array', () => {
    expect(ids).toContain('types-mixed-array');
  });

  it('surfaces inconsistent object shapes and field types in orders', () => {
    expect(ids).toContain('shape-/orders');
    expect(ids).toContain('types-field-/orders');
  });

  it('surfaces the frequently-null note field', () => {
    expect(ids).toContain('null-/orders');
  });

  it('surfaces the zero-width character in the key and the value', () => {
    expect(ids).toContain('keys-hidden');
    expect(ids).toContain('strings-hidden');
  });
});
