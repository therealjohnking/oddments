/**
 * The regex executor — the one genuinely dangerous operation in the workbench,
 * and the reason a Web Worker exists (see `components/regex-workbench/executor`).
 *
 * `executeRegex` is deliberately **self-contained**: it references only its
 * argument and JavaScript built-ins, with every helper declared inside it. That
 * is what lets the worker embed it verbatim via `Function.prototype.toString()`,
 * so there is exactly one implementation — the same code unit-tested here on the
 * main thread (with safe inputs only) runs off-thread against user text. Do not
 * introduce a free variable into this function; it would compile fine but break
 * the moment the worker tried to reconstruct it.
 *
 * Correctness notes baked in:
 *   • Zero-width matches advance `lastIndex` by one *code point* in Unicode mode
 *     (`u`/`v`) and one code unit otherwise, matching the spec's AdvanceStringIndex
 *     and `String.prototype.matchAll`. Without this, `/^/gm` or `//g` would loop
 *     forever; with a naive `+1`, `u`-mode would split astral characters.
 *   • Iteration runs when `g` or `y` is set. Sticky (`y`) semantics fall out of
 *     the engine honouring `lastIndex`; we never fake `g`.
 *   • A hard match cap bounds the result so pathological (but fast) patterns like
 *     `//g` on huge text cannot exhaust memory. Slow patterns — catastrophic
 *     backtracking inside a single `exec` — are the worker timeout's job, not
 *     something any in-loop guard can interrupt.
 */

/** A single capture group as returned by the raw executor (plain, cloneable data). */
export interface RawGroup {
  /** `null` = the group did not participate; `''` = participated, captured empty. */
  value: string | null;
  /** UTF-16 start offset, or null when unmatched or indices are unavailable. */
  start: number | null;
  /** UTF-16 end offset (exclusive), or null. */
  end: number | null;
}

export interface RawMatch {
  index: number;
  length: number;
  value: string;
  /** Numbered capture groups 1..n. */
  groups: RawGroup[];
}

export interface ExecInput {
  source: string;
  /** The flags to run with — typically the user's flags plus `d`. */
  flags: string;
  text: string;
  /** Maximum matches to collect before stopping and reporting truncation. */
  cap: number;
}

export type ExecResult =
  { ok: true; matches: RawMatch[]; truncated: boolean } | { ok: false; error: string };

/**
 * Run a regex over text and collect raw match records. Self-contained by design
 * (see the file header). Positions here are UTF-16 code-unit offsets — the only
 * kind `RegExp` produces.
 */
export function executeRegex(input: ExecInput): ExecResult {
  const source = input.source;
  const flags = input.flags;
  const text = input.text;
  const cap = input.cap;

  let re: RegExp;
  try {
    re = new RegExp(source, flags);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }

  const unicode = flags.indexOf('u') !== -1 || flags.indexOf('v') !== -1;
  const iterate = flags.indexOf('g') !== -1 || flags.indexOf('y') !== -1;

  // Advance an index past a zero-width match: one code point in Unicode mode
  // (never splitting a surrogate pair), one code unit otherwise.
  const advance = (str: string, i: number): number => {
    if (i >= str.length) return i + 1;
    if (!unicode) return i + 1;
    const first = str.charCodeAt(i);
    if (first < 0xd800 || first > 0xdbff || i + 1 >= str.length) return i + 1;
    const second = str.charCodeAt(i + 1);
    return second >= 0xdc00 && second <= 0xdfff ? i + 2 : i + 1;
  };

  const toGroups = (m: RegExpExecArray): RawGroup[] => {
    const groups: RawGroup[] = [];
    // `m.indices` is present only under the `d` flag; align to numbered groups.
    const indices = (m as RegExpExecArray & { indices?: Array<[number, number] | undefined> })
      .indices;
    for (let g = 1; g < m.length; g++) {
      const value = m[g];
      let start: number | null = null;
      let end: number | null = null;
      if (indices) {
        const range = indices[g];
        if (range) {
          start = range[0];
          end = range[1];
        }
      }
      groups.push({ value: value === undefined ? null : value, start, end });
    }
    return groups;
  };

  const matches: RawMatch[] = [];

  if (!iterate) {
    const m = re.exec(text);
    if (m) {
      matches.push({ index: m.index, length: m[0].length, value: m[0], groups: toGroups(m) });
    }
    return { ok: true, matches, truncated: false };
  }

  re.lastIndex = 0;
  let truncated = false;
  // A generous structural ceiling on iterations: at most one match per position
  // plus the cap. Real work stops at `cap`; this only guards against a logic slip.
  const iterationCeiling = text.length + cap + 2;
  let iterations = 0;

  while (true) {
    if (++iterations > iterationCeiling) {
      truncated = true;
      break;
    }
    const m = re.exec(text);
    if (m === null) break; // exhausted every match — nothing was cut off

    if (matches.length >= cap) {
      // A further match exists beyond the cap, so results really are truncated.
      // This one is deliberately not collected.
      truncated = true;
      break;
    }

    matches.push({ index: m.index, length: m[0].length, value: m[0], groups: toGroups(m) });

    if (m[0].length === 0) {
      // Zero-width: the engine did not move lastIndex, so we must, or loop forever.
      re.lastIndex = advance(text, re.lastIndex);
    }
  }

  return { ok: true, matches, truncated };
}
