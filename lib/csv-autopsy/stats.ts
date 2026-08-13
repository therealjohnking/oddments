/**
 * Summary statistics for CSV Autopsy columns.
 *
 * Deliberately lightweight: count, min, max, mean, median, plus zero/negative
 * tallies for numeric columns, and earliest/latest/parse-rate for date columns.
 * No distributions, no modelling — this is a profiler, not a stats package.
 *
 * Statistics are computed only over the values that actually parse as the column
 * type; the count is reported alongside so the coverage is explicit rather than
 * implied. Presentation rounding lives in `format.ts` — the raw numbers here stay
 * exact so tests can assert them precisely.
 */

import { parseDateLike, parseNumericLike } from './infer';
import type { DateStats, NumericStats } from './types';

/** Compute numeric statistics over the populated values that parse as numbers. */
export function computeNumericStats(populated: string[]): NumericStats | null {
  const nums: number[] = [];
  let zeros = 0;
  let negatives = 0;
  let formatted = 0;

  for (const raw of populated) {
    const parsed = parseNumericLike(raw.trim());
    if (!parsed) continue;
    nums.push(parsed.value);
    if (parsed.value === 0) zeros++;
    else if (parsed.value < 0) negatives++;
    if (parsed.formatted) formatted++;
  }

  if (nums.length === 0) return null;
  nums.sort((a, b) => a - b);

  const count = nums.length;
  let sum = 0;
  for (const n of nums) sum += n;
  const mean = sum / count;
  const mid = Math.floor(count / 2);
  const median = count % 2 === 1 ? nums[mid]! : (nums[mid - 1]! + nums[mid]!) / 2;

  return {
    count,
    min: nums[0]!,
    max: nums[count - 1]!,
    mean,
    median,
    zeros,
    negatives,
    formatted,
  };
}

/** Compute date statistics over the populated values that parse as dates/datetimes. */
export function computeDateStats(populated: string[]): DateStats | null {
  let earliestTime = Infinity;
  let latestTime = -Infinity;
  let earliest = '';
  let latest = '';
  let parsed = 0;
  let hasTime = false;

  for (const raw of populated) {
    const value = raw.trim();
    const date = parseDateLike(value);
    if (!date) continue;
    parsed++;
    if (date.hasTime) hasTime = true;
    if (date.time < earliestTime) {
      earliestTime = date.time;
      earliest = value;
    }
    if (date.time > latestTime) {
      latestTime = date.time;
      latest = value;
    }
  }

  if (parsed === 0) return null;
  return {
    earliest,
    latest,
    parseRate: parsed / populated.length,
    hasTime,
    parsed,
  };
}
