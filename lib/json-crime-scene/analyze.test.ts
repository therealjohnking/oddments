import { describe, expect, it } from 'vitest';
import { analyzeJson, type JsonAnalysis } from './index';

function ok(source: string, opts?: Parameters<typeof analyzeJson>[1]) {
  const analysis = analyzeJson(source, opts);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis;
}

describe('analyzeJson — status', () => {
  it('treats empty and whitespace-only input as empty', () => {
    expect(analyzeJson('').status).toBe('empty');
    expect(analyzeJson('   \n\t ').status).toBe('empty');
  });

  it('reports invalid JSON as an error with a message', () => {
    const analysis = analyzeJson('{"a":}');
    expect(analysis.status).toBe('error');
    if (analysis.status === 'error') expect(analysis.error.message.length).toBeGreaterThan(0);
  });

  it('analyzes valid JSON', () => {
    expect(ok('{"a":1}').status).toBe('ok');
  });
});

describe('analyzeJson — structural statistics', () => {
  it('counts values by kind, properties, depth, and hotspots', () => {
    const { profile } = ok('{"a":1,"b":[true,null,"x"],"c":{"d":1.5}}');
    expect(profile.rootKind).toBe('object');
    expect(profile.objects).toBe(2);
    expect(profile.arrays).toBe(1);
    expect(profile.strings).toBe(1);
    expect(profile.numbers).toBe(2);
    expect(profile.booleans).toBe(1);
    expect(profile.nulls).toBe(1);
    expect(profile.properties).toBe(4);
    expect(profile.totalNodes).toBe(8);
    expect(profile.maxDepth).toBe(2);
    expect(profile.largestArray?.value).toBe(3);
    expect(profile.largestObject?.value).toBe(3);
    expect(profile.longestString?.value).toBe(1);
  });

  it('measures the longest string and largest containers at the right paths', () => {
    const { profile } = ok('{"short":"a","long":"abcdef","list":[1,2,3,4,5]}');
    expect(profile.longestString).toMatchObject({ pointer: '/long', value: 6 });
    expect(profile.largestArray).toMatchObject({ pointer: '/list', value: 5 });
  });

  it('counts source bytes in UTF-8', () => {
    // "é" is two UTF-8 bytes; the surrounding {"x":"é"} is 8 ASCII bytes.
    const { profile } = ok('{"x":"é"}');
    expect(profile.sourceBytes).toBe(10);
  });
});

describe('analyzeJson — safety and limits', () => {
  it('degrades to too-complex on pathologically deep nesting rather than crashing', () => {
    const deep = '['.repeat(200000) + '1' + ']'.repeat(200000);
    const analysis = analyzeJson(deep);
    expect(analysis.status).toBe('too-complex');
    if (analysis.status === 'too-complex') expect(analysis.reason).toBe('nesting');
  });

  it('flags large input via meta.large without refusing it', () => {
    const analysis: JsonAnalysis = analyzeJson('{}', { fileSize: 5 * 1024 * 1024 });
    expect(analysis.status).toBe('ok');
    expect(analysis.meta.large).toBe(true);
  });

  it('is deterministic — identical input yields identical findings', () => {
    const src = '{"a":[{"id":1},{"id":2},{"name":"x"}]}';
    const first = ok(src);
    const second = ok(src);
    expect(JSON.stringify(first.findings)).toBe(JSON.stringify(second.findings));
  });
});
