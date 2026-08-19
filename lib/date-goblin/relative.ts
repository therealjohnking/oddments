/**
 * Human-readable comparison to "now". Kept deliberately secondary — the exact
 * timestamp is always authoritative — and computed against a caller-supplied
 * `nowMs` so it is deterministic and testable (no hidden clock reads here). The
 * UI refreshes `nowMs` at minute granularity; nothing schedules per-second work.
 */

import type { Instant, RelativeTime } from './types';

// Weeks are deliberately omitted: for a date tool "in 12 days" is clearer than
// "in 2 weeks", and the ladder stays coarse enough to avoid per-second churn.
const UNITS: { unit: Intl.RelativeTimeFormatUnit; seconds: number }[] = [
  { unit: 'year', seconds: 31_536_000 },
  { unit: 'month', seconds: 2_592_000 },
  { unit: 'day', seconds: 86_400 },
  { unit: 'hour', seconds: 3_600 },
  { unit: 'minute', seconds: 60 },
];

let cachedFormatter: Intl.RelativeTimeFormat | null = null;

function formatter(): Intl.RelativeTimeFormat {
  cachedFormatter ??= new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  return cachedFormatter;
}

/** Format the signed millisecond delta as a phrase like `3 hours ago`. */
function phrase(deltaMs: number): string {
  const abs = Math.abs(deltaMs);
  if (abs < 60_000) return 'just now';
  const rtf = formatter();
  for (const { unit, seconds } of UNITS) {
    if (abs >= seconds * 1000) {
      return rtf.format(Math.round(deltaMs / 1000 / seconds), unit);
    }
  }
  return 'just now';
}

/** Compare an instant to a supplied "now" (both in epoch milliseconds). */
export function relativeTime(instant: Instant, nowMs: number): RelativeTime {
  const deltaMilliseconds = instant.epochMilliseconds - nowMs;
  return {
    text: phrase(deltaMilliseconds),
    deltaMilliseconds,
    withinMinute: Math.abs(deltaMilliseconds) < 60_000,
  };
}
