/**
 * The diff core: Myers' O(ND) shortest-edit-script algorithm over arrays of
 * comparison keys (strings). It is deliberately the *standard* algorithm, not a
 * novel one — small, deterministic, and heavily tested against a brute-force LCS.
 *
 * Two guards keep it safe on large input:
 *   1. Common prefix/suffix are trimmed before the search (typical edits are
 *      localized, so this collapses the problem to a small middle).
 *   2. The search is bounded by a work budget derived from the input size; if the
 *      edit distance would exceed it, the middle degrades to a single non-minimal
 *      "delete all / insert all" block (still correct, just not minimal), flagged
 *      via `degraded` so the UI can say so.
 *
 * Output is a flat op list: `equal` consumes one A key and one B key, `delete`
 * one A key, `insert` one B key — enough for the caller to walk both token
 * streams in lockstep and build renderable segments.
 */

import type { DiffOp } from './types';

export interface EditScript {
  ops: DiffOp[];
  degraded: boolean;
}

export interface DiffKeysOptions {
  /** Hard cap on the search depth (edit distance). Defaults from input size. */
  maxD?: number;
}

/** Bounds the forward search so worst-case work stays ~linear-ish on huge input. */
const MAX_WORK = 150_000_000;

function boundedMaxD(n: number, m: number): number {
  const total = n + m;
  if (total <= 4000) return total; // always minimal for reasonable input
  return Math.max(1, Math.min(total, Math.floor(MAX_WORK / (total + 1))));
}

/** Diff two key arrays into a flat edit script. */
export function diffKeys(a: string[], b: string[], options: DiffKeysOptions = {}): EditScript {
  const n = a.length;
  const m = b.length;

  // Common prefix.
  let start = 0;
  while (start < n && start < m && a[start] === b[start]) start++;

  // Common suffix (not overlapping the prefix).
  let endA = n;
  let endB = m;
  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const ops: DiffOp[] = [];
  for (let i = 0; i < start; i++) ops.push('equal');

  const midA = a.slice(start, endA);
  const midB = b.slice(start, endB);
  const middle = diffMiddle(midA, midB, options.maxD);
  for (const op of middle.ops) ops.push(op);

  for (let i = endA; i < n; i++) ops.push('equal');

  return { ops, degraded: middle.degraded };
}

function blockReplace(n: number, m: number): DiffOp[] {
  const ops: DiffOp[] = [];
  for (let i = 0; i < n; i++) ops.push('delete');
  for (let j = 0; j < m; j++) ops.push('insert');
  return ops;
}

/** Myers on the trimmed middle (no shared prefix/suffix remains). */
function diffMiddle(a: string[], b: string[], maxDOverride?: number): EditScript {
  const n = a.length;
  const m = b.length;
  if (n === 0 && m === 0) return { ops: [], degraded: false };
  if (n === 0) return { ops: b.map(() => 'insert' as DiffOp), degraded: false };
  if (m === 0) return { ops: a.map(() => 'delete' as DiffOp), degraded: false };

  const maxD = maxDOverride ?? boundedMaxD(n, m);
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];

  let reached = false;
  for (let d = 0; d <= max; d++) {
    if (d > maxD) return { ops: blockReplace(n, m), degraded: true };
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      const ki = k + offset;
      let x: number;
      if (k === -d || (k !== d && v[ki - 1]! < v[ki + 1]!)) {
        x = v[ki + 1]!; // move down → an insertion from B
      } else {
        x = v[ki - 1]! + 1; // move right → a deletion from A
      }
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[ki] = x;
      if (x >= n && y >= m) {
        reached = true;
        break;
      }
    }
    if (reached) break;
  }

  return { ops: backtrack(trace, offset, n, m), degraded: false };
}

/** Walk the saved traces from (n,m) back to (0,0), emitting ops in order. */
function backtrack(trace: Int32Array[], offset: number, n: number, m: number): DiffOp[] {
  const ops: DiffOp[] = [];
  let x = n;
  let y = m;

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]!;
    const k = x - y;
    let prevK: number;
    if (k === -d || (k !== d && v[k - 1 + offset]! < v[k + 1 + offset]!)) {
      prevK = k + 1; // came from a down move (insert)
    } else {
      prevK = k - 1; // came from a right move (delete)
    }
    const prevX = v[prevK + offset]!;
    const prevY = prevX - prevK;

    while (x > prevX && y > prevY) {
      ops.push('equal');
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push('insert');
      else ops.push('delete');
    }
    x = prevX;
    y = prevY;
  }

  ops.reverse();
  return ops;
}

/**
 * A straightforward LCS length via dynamic programming — used only by tests to
 * confirm the Myers script is minimal. Exported here so the guarantee lives
 * beside the algorithm it checks. O(n·m) time and memory; small inputs only.
 */
export function lcsLength(a: string[], b: string[]): number {
  const n = a.length;
  const m = b.length;
  const dp = new Int32Array((n + 1) * (m + 1));
  const w = m + 1;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i * w + j] =
        a[i - 1] === b[j - 1]
          ? dp[(i - 1) * w + (j - 1)]! + 1
          : Math.max(dp[(i - 1) * w + j]!, dp[i * w + (j - 1)]!);
    }
  }
  return dp[n * w + m]!;
}
