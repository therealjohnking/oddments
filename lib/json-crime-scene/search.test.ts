import { describe, expect, it } from 'vitest';
import { analyzeJson, searchTree } from './index';

function tree(source: string) {
  const analysis = analyzeJson(source);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis.tree;
}

describe('searchTree', () => {
  it('finds property names', () => {
    const result = searchTree(tree('{"name":"Ada","other":1}'), 'name');
    const keyHit = result.hits.find((h) => h.where === 'key');
    expect(keyHit?.pointer).toBe('/name');
    expect(keyHit?.kind).toBe('string');
  });

  it('finds string values', () => {
    const result = searchTree(tree('{"a":"needle","b":"hay"}'), 'needle');
    expect(result.hits.some((h) => h.where === 'value' && h.pointer === '/a')).toBe(true);
  });

  it('is case-insensitive by default and case-sensitive on request', () => {
    expect(searchTree(tree('{"Name":1}'), 'name').total).toBe(1);
    expect(searchTree(tree('{"Name":1}'), 'name', { caseSensitive: true }).total).toBe(0);
  });

  it('returns nothing for an empty query', () => {
    expect(searchTree(tree('{"a":1}'), '').hits).toHaveLength(0);
  });

  it('reports results in document order', () => {
    const result = searchTree(tree('{"m1":"x","m2":"x","m3":"x"}'), 'x');
    expect(result.hits.map((h) => h.pointer)).toEqual(['/m1', '/m2', '/m3']);
  });

  it('bounds the number of hits while reporting the true total', () => {
    const items = Array.from({ length: 300 }, () => '"x"').join(',');
    const result = searchTree(tree(`[${items}]`), 'x', { limit: 50 });
    expect(result.hits).toHaveLength(50);
    expect(result.total).toBe(300);
    expect(result.capped).toBe(true);
  });

  it('can restrict matching to keys or values', () => {
    const t = tree('{"key":"key"}');
    expect(searchTree(t, 'key', { matchValues: false }).total).toBe(1);
    expect(searchTree(t, 'key', { matchKeys: false }).total).toBe(1);
  });
});
