/**
 * Converters from Temporal objects to Date Goblin's plain domain types. This is
 * the membrane: Temporal goes in, plain serialisable data comes out. Every other
 * engine module builds its results by calling these, so no Temporal object ever
 * escapes `lib/date-goblin`.
 */

import { Temporal, type TemporalTypes } from './temporal';
import { formatWallLabel, pad, zoneAbbreviation, zoneLongName } from './format';
import type { Instant, InstantReading, WallDateTime, ZonedReading } from './types';

const NS_PER_SECOND = 1_000_000_000n;

/** Floor-divide two bigints toward −∞ (bigint `/` truncates toward zero). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return a % b !== 0n && a < 0n !== b < 0n ? q - 1n : q;
}

/** Build the domain `Instant` from a `Temporal.Instant`. */
export function instantFromTemporal(inst: TemporalTypes.Instant): Instant {
  const ns = inst.epochNanoseconds;
  return {
    epochNanoseconds: ns,
    epochMilliseconds: inst.epochMilliseconds,
    epochSeconds: Number(floorDiv(ns, NS_PER_SECOND)),
    iso: inst.toString(),
    hasSubsecond: ns % NS_PER_SECOND !== 0n,
  };
}

/** Build a domain `WallDateTime` from a `Temporal.PlainDateTime`. */
export function wallFromPlainDateTime(pdt: TemporalTypes.PlainDateTime): WallDateTime {
  const nanosecond = pdt.millisecond * 1_000_000 + pdt.microsecond * 1_000 + pdt.nanosecond;
  return {
    year: pdt.year,
    month: pdt.month,
    day: pdt.day,
    hour: pdt.hour,
    minute: pdt.minute,
    second: pdt.second,
    nanosecond,
    iso: wallIso(pdt.year, pdt.month, pdt.day, pdt.hour, pdt.minute, pdt.second, nanosecond),
  };
}

/** Render a zone-free ISO wall string, trimming trailing zero sub-seconds. */
export function wallIso(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  nanosecond: number,
): string {
  const yearStr = year < 0 || year > 9999 ? signedYear(year) : pad(year, 4);
  let out = `${yearStr}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:${pad(second)}`;
  out += fractionSuffix(nanosecond);
  return out;
}

/** ISO expanded-year form for years outside 0000–9999 (e.g. `+275760`, `-000001`). */
function signedYear(year: number): string {
  const sign = year < 0 ? '-' : '+';
  return sign + pad(Math.abs(year), 6);
}

/** `.mmm`/`.uuuuuu`/`.nnnnnnnnn` suffix, or empty when the value is whole. */
function fractionSuffix(nanosecond: number): string {
  if (nanosecond === 0) return '';
  const digits = pad(nanosecond, 9).replace(/0+$/, '');
  return `.${digits}`;
}

/** Build a `ZonedReading` from a `Temporal.ZonedDateTime`. */
export function readingFromZoned(zdt: TemporalTypes.ZonedDateTime): ZonedReading {
  const wall = wallFromPlainDateTime(zdt.toPlainDateTime());
  // Round to whole minutes for the numeric field, but take the offset *string*
  // from Temporal, which is lossless (`±HH:MM`, or `±HH:MM:SS` for the historical
  // sub-minute LMT offsets that occur for pre-standardisation dates).
  const offsetMinutes = Math.round(zdt.offsetNanoseconds / 60_000_000_000);
  const epochMilliseconds = zdt.epochMilliseconds;
  const zoneId = zdt.timeZoneId;
  return {
    zoneId,
    wall,
    offsetMinutes,
    offset: zdt.offset,
    abbreviation: zoneAbbreviation(zoneId, epochMilliseconds),
    longName: zoneLongName(zoneId, epochMilliseconds),
    iso: zdt.toString({ timeZoneName: 'never', offset: 'auto' }),
    label: formatWallLabel({ ...wall, isoWeekday: zdt.dayOfWeek }),
  };
}

/** Read a domain `Instant` in a given zone as a full `InstantReading`. */
export function readInstant(instant: Instant, zoneId: string): InstantReading {
  const zdt = Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds).toZonedDateTimeISO(
    zoneId,
  );
  return { instant, reading: readingFromZoned(zdt) };
}
