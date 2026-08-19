/**
 * Resolving a wall-clock time in a zone to an instant — the heart of Date
 * Goblin, and where daylight-saving folds and gaps are surfaced instead of hidden.
 *
 * We never hand-roll DST rules. We ask Temporal for the two disambiguations the
 * spec defines — `earlier` and `later` — and read the answer:
 *
 *   • identical instants        → the reading is unambiguous (`unique`).
 *   • distinct, both round-trip → a fall-back **fold**: the clock reading occurs
 *                                 twice (`ambiguous`).
 *   • distinct, neither matches → a spring-forward **gap**: the clock reading was
 *                                 skipped (`gap`).
 *
 * A `RangeError` from Temporal means the resulting instant is outside the
 * supported ±10⁸-day window; we let it propagate for the caller to report.
 */

import { Temporal, type TemporalTypes } from './temporal';
import { instantFromTemporal, readingFromZoned, wallIso } from './core';
import { pad } from './format';
import type { InstantReading, Resolution, WallDateTime } from './types';

/** Build the `Temporal.PlainDateTime` for a domain wall time. */
function toPlainDateTime(wall: WallDateTime): TemporalTypes.PlainDateTime {
  const millisecond = Math.floor(wall.nanosecond / 1_000_000);
  const microsecond = Math.floor((wall.nanosecond % 1_000_000) / 1_000);
  const nanosecond = wall.nanosecond % 1_000;
  return Temporal.PlainDateTime.from({
    year: wall.year,
    month: wall.month,
    day: wall.day,
    hour: wall.hour,
    minute: wall.minute,
    second: wall.second,
    millisecond,
    microsecond,
    nanosecond,
  });
}

/** A `HH:MM`/`HH:MM:SS` clock label (seconds shown only when non-zero). */
function clockLabel(hour: number, minute: number, second: number): string {
  return second === 0
    ? `${pad(hour)}:${pad(minute)}`
    : `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/** Turn a `Temporal.ZonedDateTime` into an `InstantReading`. */
function toInstantReading(zdt: TemporalTypes.ZonedDateTime): InstantReading {
  return { instant: instantFromTemporal(zdt.toInstant()), reading: readingFromZoned(zdt) };
}

/**
 * Resolve a wall-clock time in a zone. May throw `RangeError` when the instant
 * would fall outside the supported range.
 */
export function resolveWallTime(wall: WallDateTime, zoneId: string): Resolution {
  const pdt = toPlainDateTime(wall);
  const earlier = pdt.toZonedDateTime(zoneId, { disambiguation: 'earlier' });
  const later = pdt.toZonedDateTime(zoneId, { disambiguation: 'later' });

  if (earlier.epochNanoseconds === later.epochNanoseconds) {
    return { kind: 'unique', reading: toInstantReading(earlier) };
  }

  const requestedIso = wallIso(
    wall.year,
    wall.month,
    wall.day,
    wall.hour,
    wall.minute,
    wall.second,
    wall.nanosecond,
  );
  const earlierMatches = plainIso(earlier) === requestedIso;
  const laterMatches = plainIso(later) === requestedIso;

  // Fall-back fold: the same wall clock maps to two real instants.
  if (earlierMatches && laterMatches) {
    const earlierOffset = Number(earlier.offsetNanoseconds / 60_000_000_000);
    const laterOffset = Number(later.offsetNanoseconds / 60_000_000_000);
    return {
      kind: 'ambiguous',
      earlier: toInstantReading(earlier),
      later: toInstantReading(later),
      shiftMinutes: earlierOffset - laterOffset,
    };
  }

  // Spring-forward gap: the wall clock never occurs. `earlier` reads before the
  // gap (pre-jump offset), `later` reads after it (post-jump offset).
  const earlierOffset = Number(earlier.offsetNanoseconds / 60_000_000_000);
  const laterOffset = Number(later.offsetNanoseconds / 60_000_000_000);
  const gapMinutes = laterOffset - earlierOffset;

  const { startLabel, endLabel } = gapBounds(earlier, gapMinutes);

  return {
    kind: 'gap',
    requested: wall,
    before: toInstantReading(earlier),
    after: toInstantReading(later),
    gapMinutes,
    gapStartLabel: startLabel,
    gapEndLabel: endLabel,
  };
}

/** Zone-free ISO of a ZonedDateTime's wall clock, for round-trip comparison. */
function plainIso(zdt: TemporalTypes.ZonedDateTime): string {
  const pdt = zdt.toPlainDateTime();
  const nanosecond = pdt.millisecond * 1_000_000 + pdt.microsecond * 1_000 + pdt.nanosecond;
  return wallIso(pdt.year, pdt.month, pdt.day, pdt.hour, pdt.minute, pdt.second, nanosecond);
}

/**
 * The wall-clock window a spring-forward skips, e.g. `02:00` → `03:00`. Derived
 * from the pre-gap reading's *next* transition, which is the spring-forward
 * itself. We deliberately look forward from `earlier` (whose instant is strictly
 * before the transition) rather than backward from `later`: when the requested
 * time is the exact start of the gap, `later`'s instant lands *on* the transition,
 * and `getTimeZoneTransition('previous')` — being exclusive — would return the
 * prior transition and mislabel the gap. Looking forward from `earlier` is correct
 * for both the boundary and interior cases.
 */
function gapBounds(
  beforeZdt: TemporalTypes.ZonedDateTime,
  gapMinutes: number,
): { startLabel: string; endLabel: string } {
  const transition = beforeZdt.getTimeZoneTransition('next');
  if (transition) {
    const end = transition.toPlainTime();
    const start = end.subtract({ minutes: gapMinutes });
    return {
      startLabel: clockLabel(start.hour, start.minute, start.second),
      endLabel: clockLabel(end.hour, end.minute, end.second),
    };
  }
  // Fallback (unreached in practice — a gap always has a transition ahead of the
  // pre-gap reading): approximate the window from the pre-gap wall clock.
  const start = beforeZdt.toPlainTime().add({ minutes: gapMinutes });
  const end = start.add({ minutes: gapMinutes });
  return {
    startLabel: clockLabel(start.hour, start.minute, start.second),
    endLabel: clockLabel(end.hour, end.minute, end.second),
  };
}
