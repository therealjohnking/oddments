import { describe, expect, it } from 'vitest';
import { analyzeJson } from './index';
import type { ArrayShapeReport } from './types';

function shapesOf(source: string): ArrayShapeReport[] {
  const analysis = analyzeJson(source);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis.shapes;
}

describe('analyzeShapes', () => {
  it('needs at least three objects to profile an array', () => {
    expect(shapesOf('[{"a":1},{"a":2}]')).toHaveLength(0);
  });

  it('reports a single dominant shape when objects are consistent', () => {
    const [report] = shapesOf('[{"id":1,"n":"a"},{"id":2,"n":"b"},{"id":3,"n":"c"}]');
    expect(report?.variants).toHaveLength(1);
    expect(report?.conformity).toBe(1);
    expect(report?.variants[0]?.dominant).toBe(true);
  });

  it('identifies a shape variant with its missing and extra keys', () => {
    const [report] = shapesOf('[{"id":1,"name":"a"},{"id":2,"name":"b"},{"id":3,"fullName":"c"}]');
    expect(report?.variants).toHaveLength(2);
    expect(report?.conformity).toBeCloseTo(2 / 3, 5);
    const variant = report?.variants.find((v) => !v.dominant);
    expect(variant?.missing).toEqual(['name']);
    expect(variant?.extra).toEqual(['fullName']);
    expect(variant?.count).toBe(1);
  });

  it('detects per-field type inconsistency and points to the offender', () => {
    const [report] = shapesOf('[{"amount":1},{"amount":2},{"amount":"x"}]');
    expect(report?.typeVariances).toHaveLength(1);
    const tv = report?.typeVariances[0];
    expect(tv?.key).toBe('amount');
    expect(tv?.dominantKind).toBe('number');
    expect(tv?.dominantCount).toBe(2);
    expect(tv?.offenders[0]).toMatchObject({ kind: 'string', pointer: '/2/amount' });
  });

  it('treats a null value as nullability, not a type conflict', () => {
    const [report] = shapesOf('[{"n":1},{"n":2},{"n":null}]');
    expect(report?.typeVariances).toHaveLength(0);
    const nn = report?.nullability.find((n) => n.key === 'n');
    expect(nn).toMatchObject({ present: 3, nulls: 1, missing: 0 });
  });

  it('counts a field missing from some objects', () => {
    const [report] = shapesOf('[{"a":1,"b":2},{"a":3,"b":4},{"a":5}]');
    const nb = report?.nullability.find((n) => n.key === 'b');
    expect(nb).toMatchObject({ present: 2, missing: 1 });
  });

  it('profiles nested arrays-of-objects too', () => {
    const reports = shapesOf('{"data":[{"a":1},{"a":2},{"a":3,"b":9}]}');
    expect(reports).toHaveLength(1);
    expect(reports[0]?.pointer).toBe('/data');
  });
});
