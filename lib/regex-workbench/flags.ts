/**
 * Flag metadata, runtime support detection, and canonicalisation.
 *
 * The eight ECMAScript flags are `d g i m s u v y`. Which ones exist is a
 * property of the *runtime*, not of our memory: `d` (match indices) and `v`
 * (Unicode sets) are recent additions, so we feature-detect every flag by trying
 * to construct a `RegExp` with it. Whatever the host supports, we expose; nothing
 * is assumed. `u` and `v` are also mutually exclusive by spec — the compiler,
 * not this module, surfaces that as a normal compile error.
 */

import type { FlagId, FlagMeta } from './types';

/** Canonical flag order, matching how `RegExp.prototype.flags` sorts them. */
export const FLAG_ORDER: readonly FlagId[] = ['d', 'g', 'i', 'm', 's', 'u', 'v', 'y'] as const;

const FLAG_INFO: Record<FlagId, { name: string; summary: string }> = {
  d: {
    name: 'indices',
    summary: 'Record the start/end position of every match and capture group (adds `.indices`).',
  },
  g: {
    name: 'global',
    summary: 'Find all matches rather than stopping at the first; enables iteration.',
  },
  i: { name: 'ignore case', summary: 'Match without regard to letter case.' },
  m: {
    name: 'multiline',
    summary: '`^` and `$` match at the start and end of each line, not just the whole input.',
  },
  s: { name: 'dotAll', summary: '`.` also matches line terminators (newlines).' },
  u: {
    name: 'unicode',
    summary:
      'Treat the pattern as Unicode: astral code points, `\\p{…}` properties, stricter escapes.',
  },
  v: {
    name: 'unicode sets',
    summary:
      'A superset of `u` adding set operations in classes (`[\\p{L}&&\\p{ASCII}]`). Excludes `u`.',
  },
  y: {
    name: 'sticky',
    summary: 'Match only exactly at `lastIndex`; the match must begin there or it fails.',
  },
};

/** Detect, once, which flags this runtime accepts. */
function detectSupport(): Set<FlagId> {
  const supported = new Set<FlagId>();
  for (const id of FLAG_ORDER) {
    try {
      void new RegExp('', id);
      supported.add(id);
    } catch {
      // Flag not supported here.
    }
  }
  return supported;
}

export const SUPPORTED_FLAGS: ReadonlySet<FlagId> = detectSupport();

export function isFlagSupported(id: FlagId): boolean {
  return SUPPORTED_FLAGS.has(id);
}

/** Flag metadata in canonical order, each carrying its runtime-support status. */
export function flagList(): FlagMeta[] {
  return FLAG_ORDER.map((id) => ({
    id,
    name: FLAG_INFO[id].name,
    summary: FLAG_INFO[id].summary,
    supported: SUPPORTED_FLAGS.has(id),
  }));
}

const FLAG_SET = new Set<string>(FLAG_ORDER);

/** Is a single character a known ECMAScript flag letter? */
export function isFlagChar(ch: string): ch is FlagId {
  return FLAG_SET.has(ch);
}

/**
 * Put a set of flag characters into canonical order and drop duplicates. Unknown
 * characters are dropped. This is presentation-only normalisation; the compiler
 * still lets the native engine have the final say on validity (e.g. `uv`
 * together, or an outright unknown letter, will fail there with a real message).
 */
export function canonicalizeFlags(flags: string): string {
  const seen = new Set<FlagId>();
  for (const ch of flags) if (isFlagChar(ch)) seen.add(ch);
  return FLAG_ORDER.filter((id) => seen.has(id)).join('');
}

/** Toggle one flag in a flag string, returning the canonical result. */
export function toggleFlag(flags: string, id: FlagId): string {
  const present = flags.includes(id);
  const next = present ? flags.replace(id, '') : flags + id;
  return canonicalizeFlags(next);
}
