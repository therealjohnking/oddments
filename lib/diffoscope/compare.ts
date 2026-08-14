/**
 * compare — turn a pair of inputs, a mode, and a lens into a renderable
 * `ModeDiff`: the inline segment stream plus exact counts.
 *
 * The domain layer wraps the diff core so the React UI never sees Myers ops or
 * token arrays — only `DiffSegment`s it can paint.
 */

import { diffKeys } from './myers';
import { lensKeys } from './normalize';
import { tokenize, tokenizeGraphemes } from './tokenize';
import {
  EXACT_LENS,
  type DiffMode,
  type DiffSegment,
  type LensState,
  type ModeDiff,
  type Token,
} from './types';

export interface DiffOptions {
  /** Run character comparison even when the input exceeds the safe size. */
  forceChar?: boolean;
  /** Cap on rendered segments (counts stay exact beyond it). */
  maxRenderSegments?: number;
  /** Per-side grapheme count above which char mode is gated behind a request. */
  charSafeLimit?: number;
}

const DEFAULT_MAX_RENDER_SEGMENTS = 6000;
const DEFAULT_CHAR_SAFE_LIMIT = 12_000;

const UNIT_LABEL: Record<DiffMode, string> = {
  word: 'word',
  char: 'character',
  line: 'line',
};

function disabledCharDiff(lens: LensState): ModeDiff {
  return {
    mode: 'char',
    lens,
    segments: [],
    unit: 'character',
    inserted: 0,
    deleted: 0,
    changedRegions: 0,
    equal: false,
    renderCapped: false,
    degraded: false,
    charDisabled: true,
  };
}

/** Compare A and B in one mode under one lens. */
export function diffInMode(
  a: string,
  b: string,
  mode: DiffMode,
  lens: LensState = EXACT_LENS,
  options: DiffOptions = {},
): ModeDiff {
  const maxRender = options.maxRenderSegments ?? DEFAULT_MAX_RENDER_SEGMENTS;
  const charSafe = options.charSafeLimit ?? DEFAULT_CHAR_SAFE_LIMIT;

  let aTokens: Token[];
  let bTokens: Token[];

  if (mode === 'char') {
    aTokens = tokenizeGraphemes(a);
    bTokens = tokenizeGraphemes(b);
    if (!options.forceChar && (aTokens.length > charSafe || bTokens.length > charSafe)) {
      return disabledCharDiff(lens);
    }
  } else {
    aTokens = tokenize(a, mode);
    bTokens = tokenize(b, mode);
  }

  const aKeys = lensKeys(aTokens, lens);
  const bKeys = lensKeys(bTokens, lens);
  const { ops, degraded } = diffKeys(aKeys, bKeys);

  // Pass 1 — exact counts from the op stream (independent of the render cap).
  let inserted = 0;
  let deleted = 0;
  let changedRegions = 0;
  let inRegion = false;
  for (const op of ops) {
    if (op === 'equal') {
      inRegion = false;
    } else {
      if (op === 'insert') inserted++;
      else deleted++;
      if (!inRegion) changedRegions++;
      inRegion = true;
    }
  }

  // Pass 2 — build (coalesced) segments up to the render cap.
  const coalesce = mode !== 'line';
  const segments = buildSegments(mode, aTokens, bTokens, ops, coalesce, maxRender);

  const result: ModeDiff = {
    mode,
    lens,
    segments: segments.list,
    unit: UNIT_LABEL[mode],
    inserted,
    deleted,
    changedRegions,
    equal: inserted === 0 && deleted === 0,
    renderCapped: segments.capped,
    degraded,
    charDisabled: false,
  };
  if (mode === 'line') result.changedLines = inserted + deleted;
  return result;
}

interface BuiltSegments {
  list: DiffSegment[];
  capped: boolean;
}

function buildSegments(
  mode: DiffMode,
  aTokens: Token[],
  bTokens: Token[],
  ops: readonly ('equal' | 'insert' | 'delete')[],
  coalesce: boolean,
  maxRender: number,
): BuiltSegments {
  const list: DiffSegment[] = [];
  let capped = false;
  let ai = 0;
  let bi = 0;

  // Coalescing buffer (word/char modes).
  let bufOp: 'equal' | 'insert' | 'delete' | null = null;
  let bufValue = '';
  let bufAStart: number | undefined;
  let bufBStart: number | undefined;

  const flush = () => {
    if (bufOp === null) return;
    if (list.length >= maxRender) {
      capped = true;
    } else {
      const segment: DiffSegment = { op: bufOp, value: bufValue };
      if (bufAStart !== undefined) segment.aStart = bufAStart;
      if (bufBStart !== undefined) segment.bStart = bufBStart;
      list.push(segment);
    }
    bufOp = null;
    bufValue = '';
    bufAStart = undefined;
    bufBStart = undefined;
  };

  const pushLine = (
    op: 'equal' | 'insert' | 'delete',
    a?: Token,
    b?: Token,
    aNo?: number,
    bNo?: number,
  ) => {
    if (list.length >= maxRender) {
      capped = true;
      return;
    }
    const token = op === 'insert' ? b! : a!;
    const segment: DiffSegment = { op, value: token.value, terminator: token.terminator };
    if (a) {
      segment.aStart = a.start;
      segment.aLine = aNo;
    }
    if (b) {
      segment.bStart = b.start;
      segment.bLine = bNo;
    }
    list.push(segment);
  };

  for (const op of ops) {
    if (mode === 'line') {
      if (op === 'equal') {
        pushLine('equal', aTokens[ai], bTokens[bi], ai + 1, bi + 1);
        ai++;
        bi++;
      } else if (op === 'delete') {
        pushLine('delete', aTokens[ai], undefined, ai + 1, undefined);
        ai++;
      } else {
        pushLine('insert', undefined, bTokens[bi], undefined, bi + 1);
        bi++;
      }
      continue;
    }

    // word / char modes (coalesced)
    if (op === 'equal') {
      const at = aTokens[ai]!;
      const bt = bTokens[bi]!;
      if (!coalesce || bufOp !== 'equal') flush();
      if (bufOp === null) {
        bufOp = 'equal';
        bufAStart = at.start;
        bufBStart = bt.start;
      }
      bufValue += at.value;
      ai++;
      bi++;
    } else if (op === 'delete') {
      const at = aTokens[ai]!;
      if (!coalesce || bufOp !== 'delete') flush();
      if (bufOp === null) {
        bufOp = 'delete';
        bufAStart = at.start;
      }
      bufValue += at.value;
      ai++;
    } else {
      const bt = bTokens[bi]!;
      if (!coalesce || bufOp !== 'insert') flush();
      if (bufOp === null) {
        bufOp = 'insert';
        bufBStart = bt.start;
      }
      bufValue += bt.value;
      bi++;
    }
  }
  flush();

  return { list, capped };
}
