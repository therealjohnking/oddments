/**
 * Match enrichment: raw executor records → display-ready `MatchRecord`s.
 *
 * This runs on the main thread after the worker returns (or after a synchronous
 * fallback run). It is pure and cheap — the expensive, interruptible work already
 * happened. Here we attach 1-based ordinals, human line/column positions (always
 * derived from, and never conflated with, the UTF-16 offsets), capture-group
 * names, and the zero-width flag that the highlight view keys off.
 */

import { LineIndex, type LineCol } from './positions';
import type { RawGroup, RawMatch } from './execute';
import type { GroupCapture, MatchRecord, MatchResult } from './types';

function locate(index: LineIndex, offset: number | null): LineCol | null {
  return offset === null ? null : index.locate(offset);
}

function toCapture(
  raw: RawGroup,
  number: number,
  name: string | null,
  index: LineIndex,
): GroupCapture {
  return {
    number,
    name,
    value: raw.value,
    start: raw.start,
    end: raw.end,
    startPos: locate(index, raw.start),
    endPos: locate(index, raw.end),
  };
}

export interface EnrichOptions {
  text: string;
  /** Name (or null) for each capturing group, by number. */
  groupNamesByNumber: (string | null)[];
  global: boolean;
  truncated: boolean;
  cap: number;
  status?: 'ok' | 'timeout';
}

export function enrichMatches(raw: RawMatch[], options: EnrichOptions): MatchResult {
  const index = new LineIndex(options.text);
  const names = options.groupNamesByNumber;

  const matches: MatchRecord[] = raw.map((m, i) => {
    const groups = m.groups.map((g, gi) => toCapture(g, gi + 1, names[gi] ?? null, index));
    return {
      ordinal: i + 1,
      start: m.index,
      end: m.index + m.length,
      length: m.length,
      value: m.value,
      empty: m.length === 0,
      startPos: index.locate(m.index),
      endPos: index.locate(m.index + m.length),
      groups,
      namedGroups: groups.filter((g) => g.name !== null),
    };
  });

  return {
    status: options.status ?? 'ok',
    matches,
    global: options.global,
    truncated: options.truncated,
    cap: options.cap,
  };
}

/** An empty (no-run / timeout) result, so the UI never handles `null`. */
export function emptyMatchResult(
  status: 'ok' | 'timeout',
  global: boolean,
  cap: number,
): MatchResult {
  return { status, matches: [], global, truncated: false, cap };
}
