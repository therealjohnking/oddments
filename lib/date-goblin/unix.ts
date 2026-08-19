/**
 * Unix timestamp interpretation.
 *
 * Two things make this correctness-critical: unit ambiguity (the same digits can
 * be seconds, milliseconds, microseconds, or nanoseconds) and precision (Temporal
 * carries nanoseconds; a plain number would not). We therefore work in `bigint`
 * nanoseconds throughout, and we refuse to silently pick a unit when more than one
 * interpretation lands on a plausible date — the classic "is this seconds or
 * milliseconds?" trap. Auto-detection uses digit count as the primary signal but
 * always cross-checks plausibility and always names the alternative it set aside.
 */

import { Temporal } from './temporal';
import { instantFromTemporal } from './core';
import { nsInRange } from './range';
import type { AmbiguityCandidate, Instant, Recognition, UnixUnit } from './types';

type ConcreteUnit = Exclude<UnixUnit, 'auto'>;

const UNIT_ORDER: ConcreteUnit[] = ['seconds', 'milliseconds', 'microseconds', 'nanoseconds'];

const NS_PER_UNIT: Record<ConcreteUnit, bigint> = {
  seconds: 1_000_000_000n,
  milliseconds: 1_000_000n,
  microseconds: 1_000n,
  nanoseconds: 1n,
};

const UNIT_LABEL: Record<ConcreteUnit, string> = {
  seconds: 'seconds',
  milliseconds: 'milliseconds',
  microseconds: 'microseconds',
  nanoseconds: 'nanoseconds',
};

/** Plausible-year window used to sanity-check an auto-detected unit. */
const SANE_MIN_YEAR = 1678;
const SANE_MAX_YEAR = 2262;

/** A numeric string, or `null` if `raw` is not a bare (optionally fractional) number. */
function numericParts(raw: string): { sign: 1 | -1; int: string; frac: string } | null {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw);
  if (!match) return null;
  const sign = match[1] === '-' ? -1 : 1;
  return { sign, int: match[2] ?? '', frac: match[3] ?? '' };
}

/** Round-half-up division of non-negative bigints. */
function roundDiv(numerator: bigint, denom: bigint): bigint {
  const q = numerator / denom;
  const r = numerator % denom;
  return r * 2n >= denom ? q + 1n : q;
}

/**
 * Convert a numeric string to nanoseconds for a given unit. `rounded` is true
 * when a fractional input carried finer precision than a nanosecond (which we
 * round rather than invent).
 */
function toNanoseconds(
  parts: { sign: 1 | -1; int: string; frac: string },
  unit: ConcreteUnit,
): { ns: bigint; rounded: boolean } {
  const perUnit = NS_PER_UNIT[unit];
  if (parts.frac === '') {
    return { ns: BigInt(parts.sign) * BigInt(parts.int) * perUnit, rounded: false };
  }
  const combined = BigInt(parts.int + parts.frac);
  const denom = 10n ** BigInt(parts.frac.length);
  const numerator = combined * perUnit;
  const magnitude = roundDiv(numerator, denom);
  const rounded = numerator % denom !== 0n;
  return { ns: BigInt(parts.sign) * magnitude, rounded };
}

/** The UTC year for an epoch-nanosecond value, or `null` if out of range. */
function yearOf(ns: bigint): number | null {
  if (!nsInRange(ns)) return null;
  try {
    return Temporal.Instant.fromEpochNanoseconds(ns).toZonedDateTimeISO('UTC').year;
  } catch {
    return null;
  }
}

/** Canonical UTC ISO for an epoch-nanosecond value, or `null` if out of range. */
function isoOf(ns: bigint): string | null {
  if (!nsInRange(ns)) return null;
  try {
    return Temporal.Instant.fromEpochNanoseconds(ns).toString();
  } catch {
    return null;
  }
}

interface UnitEval {
  unit: ConcreteUnit;
  ns: bigint;
  rounded: boolean;
  year: number | null;
  sane: boolean;
  iso: string | null;
}

function evalUnit(
  parts: { sign: 1 | -1; int: string; frac: string },
  unit: ConcreteUnit,
): UnitEval {
  const { ns, rounded } = toNanoseconds(parts, unit);
  const year = yearOf(ns);
  const sane = year !== null && year >= SANE_MIN_YEAR && year <= SANE_MAX_YEAR;
  return { unit, ns, rounded, year, sane, iso: isoOf(ns) };
}

/** Digit-count bucket → the unit auto-detection tries first. */
function bucketUnit(digits: number): ConcreteUnit {
  if (digits <= 11) return 'seconds';
  if (digits <= 14) return 'milliseconds';
  if (digits <= 16) return 'microseconds';
  return 'nanoseconds';
}

export type UnixParse =
  | { status: 'instant'; instant: Instant; recognition: Recognition }
  | { status: 'ambiguous'; message: string; candidates: AmbiguityCandidate[]; hint?: string }
  | { status: 'error'; error: { code: string; message: string; hint?: string } };

function candidate(ev: UnitEval): AmbiguityCandidate {
  return {
    label: `As Unix ${UNIT_LABEL[ev.unit]}`,
    preview: ev.iso ?? 'out of range',
    detail: `Set the unit to ${UNIT_LABEL[ev.unit]}`,
  };
}

function toInstant(ns: bigint): Instant {
  return instantFromTemporal(Temporal.Instant.fromEpochNanoseconds(ns));
}

/** Build the success recognition for a chosen unit. */
function recognize(
  ev: UnitEval,
  digits: number,
  explicit: boolean,
  alternatives: UnitEval[],
): Recognition {
  const digitNote = explicit ? `explicit unit` : `${digits} digit${digits === 1 ? '' : 's'}`;
  let assumption: string | undefined;
  if (!explicit) {
    // Name the classic seconds↔milliseconds alternative so nothing is hidden.
    const other = alternatives.find(
      (a) => a.unit === (ev.unit === 'seconds' ? 'milliseconds' : 'seconds'),
    );
    if (other?.iso) {
      assumption = `Auto-detected ${UNIT_LABEL[ev.unit]} from the ${digitNote}. As ${UNIT_LABEL[other.unit]} it would be ${other.iso}.`;
    } else {
      assumption = `Auto-detected ${UNIT_LABEL[ev.unit]} from the ${digitNote}.`;
    }
  }
  return {
    mode: 'unix',
    kind: 'instant',
    summary: `Recognized as a Unix timestamp in ${UNIT_LABEL[ev.unit]} (${digitNote}).`,
    unixUnit: ev.unit,
    assumption,
  };
}

/**
 * Interpret a numeric token as a Unix timestamp under an explicit or auto unit.
 */
export function parseUnix(raw: string, unit: UnixUnit): UnixParse {
  const parts = numericParts(raw.trim());
  if (!parts) {
    return {
      status: 'error',
      error: { code: 'not-numeric', message: 'This is not a plain numeric timestamp.' },
    };
  }
  const digits = parts.int.replace(/^0+(?=\d)/, '').length;

  // Explicit unit: use it, but still report out-of-range honestly.
  if (unit !== 'auto') {
    const ev = evalUnit(parts, unit);
    if (!nsInRange(ev.ns)) {
      return {
        status: 'error',
        error: {
          code: 'out-of-range',
          message: `As Unix ${UNIT_LABEL[unit]}, this is outside the supported date range (roughly years −271821 to 275760).`,
          hint: 'Check the unit, or whether the value is really a timestamp.',
        },
      };
    }
    return {
      status: 'instant',
      instant: toInstant(ev.ns),
      recognition: recognize(ev, digits, true, []),
    };
  }

  // Auto: evaluate every unit, then decide.
  const evals = UNIT_ORDER.map((u) => evalUnit(parts, u));
  const byUnit = new Map(evals.map((e) => [e.unit, e]));
  const picked = byUnit.get(bucketUnit(digits))!;

  if (nsInRange(picked.ns) && picked.sane) {
    return {
      status: 'instant',
      instant: toInstant(picked.ns),
      recognition: recognize(picked, digits, false, evals),
    };
  }

  const sane = evals.filter((e) => e.sane);
  if (sane.length === 1) {
    const only = sane[0]!;
    const bucketLabel = UNIT_LABEL[bucketUnit(digits)];
    // Distinguish "outside the supported range" (no year at all) from "in range
    // but an implausible year" — the old wording claimed the former for both.
    const bucketReason =
      picked.year === null
        ? `is outside the supported range as ${bucketLabel}`
        : `gives an implausible date (year ${picked.year}) as ${bucketLabel}`;
    const rec = recognize(only, digits, false, evals);
    rec.assumption = `The ${digits}-digit value ${bucketReason}; interpreted as ${UNIT_LABEL[only.unit]} (${only.iso}), the only unit that yields a plausible date.`;
    return { status: 'instant', instant: toInstant(only.ns), recognition: rec };
  }

  if (sane.length >= 2) {
    return {
      status: 'ambiguous',
      message: `This number is a plausible Unix timestamp in more than one unit. Choose which you mean.`,
      candidates: sane.map(candidate),
      hint: 'Set an explicit unit (seconds / milliseconds / microseconds / nanoseconds).',
    };
  }

  // No unit yields a plausible date. Fall back to the digit bucket if in range.
  if (nsInRange(picked.ns)) {
    const rec = recognize(picked, digits, false, evals);
    rec.assumption = `Auto-detected ${UNIT_LABEL[picked.unit]} from the ${digits} digits, but the resulting date is well outside the typical range — double-check the unit.`;
    return { status: 'instant', instant: toInstant(picked.ns), recognition: rec };
  }
  const inRange = evals.find((e) => nsInRange(e.ns));
  if (inRange) {
    return {
      status: 'ambiguous',
      message: `This number is out of range as ${UNIT_LABEL[bucketUnit(digits)]}. Choose an explicit unit.`,
      candidates: evals.filter((e) => nsInRange(e.ns)).map(candidate),
      hint: 'Set an explicit unit.',
    };
  }
  return {
    status: 'error',
    error: {
      code: 'out-of-range',
      message: 'This number is outside the supported date range in every Unix unit.',
      hint: 'It may not be a Unix timestamp.',
    },
  };
}
