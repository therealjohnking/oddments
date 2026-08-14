import { describe, expect, it } from 'vitest';
import { analyzeJson, canSortKeys, toMinified, toPretty, toSortedKeys } from './index';

function okA(source: string) {
  const analysis = analyzeJson(source);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis;
}

describe('toPretty / toMinified', () => {
  it('pretty-prints with 2-space indent, preserving member order', () => {
    const a = okA('{"b":1,"a":[2,3]}');
    expect(toPretty(a.tree, a.source)).toBe('{\n  "b": 1,\n  "a": [\n    2,\n    3\n  ]\n}');
  });

  it('minifies away insignificant whitespace', () => {
    const a = okA('{\n  "a" : 1,\n  "b" : [ 2, 3 ]\n}');
    expect(toMinified(a.tree, a.source)).toBe('{"a":1,"b":[2,3]}');
  });

  it('renders empty containers compactly', () => {
    const a = okA('{"a":{},"b":[]}');
    expect(toMinified(a.tree, a.source)).toBe('{"a":{},"b":[]}');
  });

  it('is lossless for unsafe integers (no round-trip through a double)', () => {
    const a = okA('{"id":9223372036854775807}');
    expect(toMinified(a.tree, a.source)).toContain('9223372036854775807');
  });

  it('preserves the exact string escapes from the source', () => {
    const a = okA('{"s":"a\\u00e9b"}');
    // The escape stays escaped rather than being decoded to "é".
    expect(toMinified(a.tree, a.source)).toBe('{"s":"a\\u00e9b"}');
  });

  it('preserves duplicate keys through a transform', () => {
    const a = okA('{"a":1,"a":2}');
    expect(toMinified(a.tree, a.source)).toBe('{"a":1,"a":2}');
  });

  it('round-trips ordinary JSON through minify', () => {
    const src = '{"x":[1,{"y":true,"z":null}],"w":"hi"}';
    const a = okA(src);
    expect(JSON.parse(toMinified(a.tree, a.source))).toEqual(JSON.parse(src));
  });
});

describe('toSortedKeys / canSortKeys', () => {
  it('sorts object members by key', () => {
    const a = okA('{"b":1,"a":2,"c":3}');
    expect(toSortedKeys(a.tree, a.source)).toBe('{\n  "a": 2,\n  "b": 1,\n  "c": 3\n}');
  });

  it('is disabled when duplicate keys make sorting unsafe', () => {
    expect(canSortKeys(true)).toBe(false);
    expect(canSortKeys(false)).toBe(true);
    expect(okA('{"a":1,"a":2}').hasDuplicateKeys).toBe(true);
  });
});

describe('transforms never mutate the source', () => {
  it('leaves analysis.source untouched', () => {
    const src = '{"a":1}';
    const a = okA(src);
    toPretty(a.tree, a.source);
    toMinified(a.tree, a.source);
    toSortedKeys(a.tree, a.source);
    expect(a.source).toBe(src);
  });
});
