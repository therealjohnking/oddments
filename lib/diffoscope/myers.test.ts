import { describe, expect, it } from 'vitest';
import { diffKeys, lcsLength } from './myers';

/** Apply an edit script to `a` and confirm it reconstructs `b`. */
function reconstruct(a: string[], b: string[]): string[] {
  const { ops } = diffKeys(a, b);
  const out: string[] = [];
  let ai = 0;
  let bi = 0;
  for (const op of ops) {
    if (op === 'equal') {
      out.push(a[ai]!);
      ai++;
      bi++;
    } else if (op === 'delete') {
      ai++;
    } else {
      out.push(b[bi]!);
      bi++;
    }
  }
  return out;
}

/** Number of non-equal ops (the edit distance the script encodes). */
function editDistance(a: string[], b: string[]): number {
  const { ops } = diffKeys(a, b);
  return ops.filter((op) => op !== 'equal').length;
}

describe('diffKeys — basics', () => {
  it('is all-equal for identical arrays', () => {
    const { ops } = diffKeys(['a', 'b', 'c'], ['a', 'b', 'c']);
    expect(ops).toEqual(['equal', 'equal', 'equal']);
  });

  it('is all-insert against an empty left side', () => {
    const { ops } = diffKeys([], ['a', 'b']);
    expect(ops).toEqual(['insert', 'insert']);
  });

  it('is all-delete against an empty right side', () => {
    const { ops } = diffKeys(['a', 'b'], []);
    expect(ops).toEqual(['delete', 'delete']);
  });

  it('handles two empty arrays', () => {
    expect(diffKeys([], []).ops).toEqual([]);
  });

  it('preserves a common prefix and suffix around a middle change', () => {
    const { ops } = diffKeys(['x', 'a', 'y'], ['x', 'b', 'y']);
    expect(ops).toEqual(['equal', 'delete', 'insert', 'equal']);
  });
});

describe('diffKeys — reconstruction and minimality (brute force)', () => {
  // A small deterministic PRNG so the test is reproducible without Math.random.
  function makeRng(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x100000000;
    };
  }

  it('reconstructs B and matches the optimal edit distance for many random pairs', () => {
    const rng = makeRng(20260813);
    const alphabet = ['a', 'b', 'c', 'd'];
    for (let trial = 0; trial < 400; trial++) {
      const n = Math.floor(rng() * 9);
      const m = Math.floor(rng() * 9);
      const a = Array.from({ length: n }, () => alphabet[Math.floor(rng() * alphabet.length)]!);
      const b = Array.from({ length: m }, () => alphabet[Math.floor(rng() * alphabet.length)]!);

      expect(reconstruct(a, b)).toEqual(b);

      // Optimal edit distance = n + m - 2 * LCS.
      const optimal = a.length + b.length - 2 * lcsLength(a, b);
      expect(editDistance(a, b)).toBe(optimal);
    }
  });
});

describe('diffKeys — degraded fallback', () => {
  it('degrades to a block replace when the edit distance exceeds maxD', () => {
    const a = ['a', 'b', 'c', 'd', 'e'];
    const b = ['v', 'w', 'x', 'y', 'z'];
    const { ops, degraded } = diffKeys(a, b, { maxD: 1 });
    expect(degraded).toBe(true);
    expect(ops).toEqual([
      'delete',
      'delete',
      'delete',
      'delete',
      'delete',
      'insert',
      'insert',
      'insert',
      'insert',
      'insert',
    ]);
    // A block replace still reconstructs B correctly.
    const out: string[] = [];
    let bi = 0;
    for (const op of ops) if (op === 'insert') out.push(b[bi++]!);
    expect(out).toEqual(b);
  });

  it('does not degrade when the shared prefix/suffix keeps the middle small', () => {
    const a = ['p', 'p', 'x', 's', 's'];
    const b = ['p', 'p', 'y', 's', 's'];
    const { degraded } = diffKeys(a, b, { maxD: 2 });
    expect(degraded).toBe(false);
  });
});
