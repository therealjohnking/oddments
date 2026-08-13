/**
 * The Slopometer scoring model.
 *
 * The score is a transparent, deterministic sum of per-rule contributions —
 * nothing more. It is NOT a probability, a grade, a readability measure, or a
 * judgment of the writer. A high score only means "this text contains many of
 * the specific stylistic tics Slopometer looks for."
 *
 * Two shapes of contribution, chosen per rule so length never inflates the
 * score on its own:
 *
 *  - `occurrencePoints`  — phrase-level clichés score a fixed amount per hit and
 *    then saturate at a per-rule cap. A handful of stock phrases is the signal;
 *    a longer document does not accrue more just for being longer.
 *
 *  - `densityPoints`     — punctuation/emphasis habits are normalized against
 *    word count: every rule grants a length-proportional "free allowance" and
 *    only scores the excess. Eleven em dashes in 600 words is notable; eleven in
 *    a novel is not.
 *
 *  - `ratioPoints`       — structural habits score on a proportion (e.g. the
 *    fraction of paragraphs that are a single sentence) above a threshold, and
 *    only once a minimum sample size is met, so tiny inputs can't spike.
 *
 * Every rule also has its own maximum, so no single habit can dominate. The
 * final score is the sum of all contributions, clamped to 100.
 */

import type { BandInfo } from './types';

/** Result of applying a per-rule cap to a raw point value. */
export interface CappedPoints {
  points: number;
  atCap: boolean;
}

function cap(raw: number, max: number): CappedPoints {
  if (raw >= max) return { points: max, atCap: true };
  return { points: raw, atCap: false };
}

/**
 * Fixed points per occurrence, saturating at `max`. Used for phrase-level
 * clichés where each hit is independently meaningful.
 */
export function occurrencePoints(count: number, perOccurrence: number, max: number): CappedPoints {
  if (count <= 0) return { points: 0, atCap: false };
  return cap(count * perOccurrence, max);
}

/**
 * Length-normalized points. `freeEvery` words of text earn one "free"
 * occurrence; only occurrences beyond that allowance score, at `perExcess`
 * each, saturating at `max`.
 */
export function densityPoints(
  count: number,
  words: number,
  freeEvery: number,
  perExcess: number,
  max: number,
): CappedPoints {
  if (count <= 0) return { points: 0, atCap: false };
  const allowance = words / freeEvery;
  const excess = Math.max(0, count - allowance);
  return cap(excess * perExcess, max);
}

/**
 * Points for a proportion above a threshold. `ratio` in [0,1]; contributions
 * begin above `threshold` and scale by `perUnit` (points per full 1.0 of ratio
 * above the threshold), saturating at `max`.
 */
export function ratioPoints(
  ratio: number,
  threshold: number,
  perUnit: number,
  max: number,
): CappedPoints {
  const excess = Math.max(0, ratio - threshold);
  if (excess <= 0) return { points: 0, atCap: false };
  return cap(excess * perUnit, max);
}

/**
 * Score bands. Deliberately comedic and deliberately NOT about authorship — the
 * copy never implies a machine wrote the text, only that it leans on formula.
 */
export const BANDS: BandInfo[] = [
  {
    id: 'human',
    label: 'Apparently written by a person',
    min: 0,
    max: 19,
    blurb:
      'Barely a whiff of formula. Either genuinely plain writing or a very disciplined author.',
  },
  {
    id: 'linkedin',
    label: 'Trace amounts of LinkedIn',
    min: 20,
    max: 39,
    blurb: 'A few habits are showing. Nothing an editor and a quiet afternoon could not walk back.',
  },
  {
    id: 'content',
    label: 'Content Strategy Detected',
    min: 40,
    max: 69,
    blurb: 'The templates are load-bearing now. Optimized for engagement more than for a reader.',
  },
  {
    id: 'thought-leadership',
    label: 'Executive Thought Leadership Event',
    min: 70,
    max: 100,
    blurb: 'Peak performative prose. Somewhere a slide deck is quietly applauding itself.',
  },
];

/** Map a 0–100 score to its band. */
export function scoreToBand(score: number): BandInfo {
  for (const band of BANDS) {
    if (score >= band.min && score <= band.max) return band;
  }
  // Unreachable for clamped scores, but keep a total function.
  return BANDS[BANDS.length - 1]!;
}
