import { describe, expect, it } from 'vitest';
import { executeRegex, type ExecResult } from './execute';

function run(source: string, flags: string, text: string, cap = 1000): ExecResult {
  return executeRegex({ source, flags, text, cap });
}

function ok(result: ExecResult) {
  if (!result.ok) throw new Error('expected ok result');
  return result;
}

describe('executeRegex — basic matching', () => {
  it('finds a single match without the global flag', () => {
    const r = ok(run('a', '', 'banana'));
    expect(r.matches).toHaveLength(1);
    expect(r.matches[0]).toMatchObject({ index: 1, length: 1, value: 'a' });
  });

  it('finds all matches with the global flag', () => {
    const r = ok(run('a', 'g', 'banana'));
    expect(r.matches.map((m) => m.index)).toEqual([1, 3, 5]);
  });

  it('returns no matches when nothing matches', () => {
    expect(ok(run('z', 'g', 'abc')).matches).toEqual([]);
  });

  it('handles adjacent matches', () => {
    expect(ok(run('a', 'g', 'aaa')).matches.map((m) => m.index)).toEqual([0, 1, 2]);
  });

  it('matches multi-character runs', () => {
    const r = ok(run('\\d+', 'g', 'a12b345'));
    expect(r.matches.map((m) => m.value)).toEqual(['12', '345']);
    expect(r.matches.map((m) => m.index)).toEqual([1, 4]);
  });
});

describe('executeRegex — capture groups', () => {
  it('captures numbered groups with ranges under the d flag', () => {
    const r = ok(run('(\\d{4})-(\\d{2})', 'd', '2026-08'));
    const [m] = r.matches;
    expect(m!.groups).toHaveLength(2);
    expect(m!.groups[0]).toMatchObject({ value: '2026', start: 0, end: 4 });
    expect(m!.groups[1]).toMatchObject({ value: '08', start: 5, end: 7 });
  });

  it('distinguishes an unmatched group (null) from an empty capture ("")', () => {
    const unmatched = ok(run('(a)|(b)', '', 'a')).matches[0]!;
    expect(unmatched.groups[0]!.value).toBe('a');
    expect(unmatched.groups[1]!.value).toBeNull();

    const empty = ok(run('(x*)y', '', 'y')).matches[0]!;
    expect(empty.groups[0]!.value).toBe('');
  });

  it('keeps only the final iteration of a repeated capture (JS semantics)', () => {
    const r = ok(run('(a)+', '', 'aaa')).matches[0]!;
    expect(r.groups[0]!.value).toBe('a');
  });

  it('resolves backreferences', () => {
    // A quote, some content, then the same quote again.
    const r = ok(run('(["\'])(\\w+)\\1', 'g', `say "hi" and 'bye'`));
    expect(r.matches.map((m) => m.value)).toEqual(['"hi"', "'bye'"]);
    expect(r.matches[0]!.groups[1]!.value).toBe('hi');
  });
});

describe('executeRegex — sticky semantics', () => {
  it('anchors each match at lastIndex and stops at the first gap', () => {
    expect(ok(run('a', 'y', 'aab')).matches.map((m) => m.index)).toEqual([0, 1]);
  });

  it('fails immediately when the first position does not match', () => {
    expect(ok(run('a', 'y', 'baa')).matches).toEqual([]);
  });
});

describe('executeRegex — zero-width matches', () => {
  it('emits empty matches for anchors and terminates', () => {
    const r = ok(run('^', 'gm', 'x\ny'));
    expect(r.matches.map((m) => ({ i: m.index, len: m.length }))).toEqual([
      { i: 0, len: 0 },
      { i: 2, len: 0 },
    ]);
  });

  it('emits an empty match at every position for the empty pattern', () => {
    expect(ok(run('', 'g', 'ab')).matches.map((m) => m.index)).toEqual([0, 1, 2]);
  });

  it('matches word boundaries as zero-width', () => {
    const r = ok(run('\\b', 'g', 'hi there'));
    expect(r.matches.every((m) => m.length === 0)).toBe(true);
    expect(r.matches.map((m) => m.index)).toEqual([0, 2, 3, 8]);
  });

  it('never loops forever on a nullable global pattern', () => {
    // If the zero-width advance were missing this would hang; the cap also guards.
    const r = ok(run('a*', 'g', 'aa bb'));
    expect(r.matches.length).toBeLessThan(20);
  });
});

describe('executeRegex — Unicode advance on empty matches', () => {
  it('advances by one code unit without u', () => {
    expect(ok(run('', 'g', '😀')).matches.map((m) => m.index)).toEqual([0, 1, 2]);
  });

  it('advances by one code point (no surrogate split) with u', () => {
    expect(ok(run('', 'gu', '😀')).matches.map((m) => m.index)).toEqual([0, 2]);
  });

  it('matches astral letters with \\p{L} under u', () => {
    const r = ok(run('\\p{L}+', 'gu', 'a𝔘b'));
    expect(r.matches[0]!.value).toBe('a𝔘b');
  });
});

describe('executeRegex — limits and errors', () => {
  it('truncates at the match cap', () => {
    const r = ok(run('', 'g', 'a'.repeat(50), 10));
    expect(r.matches).toHaveLength(10);
    expect(r.truncated).toBe(true);
  });

  it('does not report truncation when the total lands exactly on the cap', () => {
    const r = ok(run('a', 'g', 'aaa', 3));
    expect(r.matches).toHaveLength(3);
    expect(r.truncated).toBe(false);
  });

  it('reports truncation only when a match beyond the cap actually exists', () => {
    const r = ok(run('a', 'g', 'aaaa', 3));
    expect(r.matches).toHaveLength(3);
    expect(r.truncated).toBe(true);
  });

  it('reports a compile failure defensively', () => {
    const r = run('(', 'g', 'x');
    expect(r.ok).toBe(false);
  });
});
