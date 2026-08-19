/**
 * The supported temporal range. `Temporal.Instant` and JavaScript's `Date` share
 * exactly the same bound: ±10⁸ days from the Unix epoch. Working in one place
 * keeps every module's range checks consistent and lets the UI honestly report
 * whether a value "fits in a JS Date".
 */

import type { Instant, RangeInfo } from './types';

/** ±10⁸ days expressed in milliseconds — the JS `Date` / `Temporal.Instant` limit. */
export const MAX_EPOCH_MS = 8_640_000_000_000_000;
export const MIN_EPOCH_MS = -8_640_000_000_000_000;

/** The same bound in nanoseconds (the authoritative precision). */
export const MAX_EPOCH_NS = 8_640_000_000_000_000_000_000n;
export const MIN_EPOCH_NS = -8_640_000_000_000_000_000_000n;

/** True when a nanosecond count is inside the supported range. */
export function nsInRange(ns: bigint): boolean {
  return ns >= MIN_EPOCH_NS && ns <= MAX_EPOCH_NS;
}

/** True when a millisecond count is inside the supported range. */
export function msInRange(ms: number): boolean {
  return Number.isFinite(ms) && ms >= MIN_EPOCH_MS && ms <= MAX_EPOCH_MS;
}

/** Range facts for a resolved instant (both bounds are identical here). */
export function rangeInfo(instant: Instant): RangeInfo {
  const ok = nsInRange(instant.epochNanoseconds);
  return { inSupportedRange: ok, fitsJsDate: ok };
}
