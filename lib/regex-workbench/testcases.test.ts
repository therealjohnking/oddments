import { describe, expect, it } from 'vitest';
import { evaluateTestCases, patternMatches } from './testcases';
import type { TestCase } from './types';

describe('patternMatches', () => {
  it('reports a match without side effects from g/y', () => {
    expect(patternMatches('\\d+', 'g', 'abc 123')).toBe(true);
    expect(patternMatches('\\d+', 'g', 'abc')).toBe(false);
  });

  it('is stable across repeated calls (no lastIndex drift)', () => {
    for (let i = 0; i < 3; i++) expect(patternMatches('a', 'gy', 'ba')).toBe(true);
  });
});

describe('evaluateTestCases', () => {
  const cases: TestCase[] = [
    { id: '1', text: 'ABC-123', expected: 'match' },
    { id: '2', text: 'abc-123', expected: 'no-match' },
  ];

  it('passes when observed result meets expectation', () => {
    const results = evaluateTestCases('[A-Z]+-\\d+', '', cases);
    expect(results).toEqual([
      { id: '1', matched: true, pass: true },
      { id: '2', matched: false, pass: true },
    ]);
  });

  it('fails a row whose expectation is not met', () => {
    const results = evaluateTestCases('.+', '', cases);
    // ".+" matches both, so the "no-match" row fails.
    expect(results[1]).toEqual({ id: '2', matched: true, pass: false });
  });
});
