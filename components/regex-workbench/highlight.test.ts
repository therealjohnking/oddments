import { describe, expect, it } from 'vitest';
import type { MatchRecord } from '@/lib/regex-workbench';
import { buildHighlight } from './highlight';

function mk(start: number, end: number): MatchRecord {
  return {
    ordinal: 1,
    start,
    end,
    length: end - start,
    value: '',
    empty: end === start,
    startPos: { line: 1, column: start + 1 },
    endPos: { line: 1, column: end + 1 },
    groups: [],
    namedGroups: [],
  };
}

describe('buildHighlight', () => {
  it('interleaves text and match runs', () => {
    const model = buildHighlight('abcabc', [mk(1, 3), mk(4, 6)], 1000);
    expect(model.segments).toEqual([
      { kind: 'text', text: 'a' },
      { kind: 'match', text: 'bc', match: expect.any(Object) },
      { kind: 'text', text: 'a' },
      { kind: 'match', text: 'bc', match: expect.any(Object) },
    ]);
    expect(model.truncated).toBe(false);
  });

  it('emits a zero-width marker that consumes no text', () => {
    const model = buildHighlight('ab', [mk(0, 0), mk(2, 2)], 1000);
    expect(model.segments).toEqual([
      { kind: 'zero', match: expect.any(Object) },
      { kind: 'text', text: 'ab' },
      { kind: 'zero', match: expect.any(Object) },
    ]);
  });

  it('caps rendering and drops matches beyond the window', () => {
    const text = 'x'.repeat(20);
    const model = buildHighlight(text, [mk(0, 1), mk(15, 16)], 10);
    expect(model.truncated).toBe(true);
    // Only the first match is inside the 10-unit window.
    const matchRuns = model.segments.filter((s) => s.kind === 'match');
    expect(matchRuns).toHaveLength(1);
    // The rendered text never exceeds the cap.
    const rendered = model.segments
      .map((s) => (s.kind === 'text' ? s.text : s.kind === 'match' ? s.text : ''))
      .join('');
    expect(rendered.length).toBeLessThanOrEqual(10);
  });
});
