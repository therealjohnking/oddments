/**
 * IANA time-zone handling: the selectable zone list, the user's system zone,
 * validation, and per-instant offset / daylight-saving context.
 *
 * Zones are always real IANA identifiers (`America/New_York`), never ambiguous
 * abbreviations like "EST". The list comes from the runtime's own tz database via
 * `Intl.supportedValuesOf('timeZone')` — the same database Temporal reads — so it
 * is current and needs no bundled copy. A small curated shortlist backs quick
 * actions and older runtimes that lack `supportedValuesOf`.
 */

import { Temporal } from './temporal';
import { zoneAbbreviation, zoneLongName } from './format';
import type { Instant, ZoneOffsetInfo } from './types';

/** UTC, always offered prominently and always valid. */
export const UTC = 'UTC';

/**
 * A curated shortlist for quick-add and as a fallback zone list. Real IANA ids,
 * spanning the offsets and DST behaviours worth having one click away.
 */
export const COMMON_ZONES: readonly string[] = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Indiana/Indianapolis',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Africa/Cairo',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Kathmandu',
  'Australia/Sydney',
  'Australia/Lord_Howe',
  'Pacific/Auckland',
  'Pacific/Chatham',
];

let cachedZones: string[] | null = null;

/** The full selectable zone list, memoised. UTC is guaranteed present and first. */
export function allZones(): string[] {
  if (cachedZones) return cachedZones;
  let list: string[];
  try {
    const supported = (
      Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
    ).supportedValuesOf?.('timeZone');
    list = Array.isArray(supported) && supported.length > 0 ? supported.slice() : [...COMMON_ZONES];
  } catch {
    list = [...COMMON_ZONES];
  }
  const withoutUtc = list.filter((z) => z !== UTC).sort((a, b) => a.localeCompare(b));
  cachedZones = [UTC, ...withoutUtc];
  return cachedZones;
}

/** The user's system zone, from browser internationalisation (never geolocation). */
export function systemZone(): string {
  try {
    const zone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (zone && isValidZone(zone)) return zone;
  } catch {
    // fall through
  }
  return UTC;
}

/** True when `id` is a zone the runtime can resolve. */
export function isValidZone(id: string): boolean {
  if (id === UTC) return true;
  if (typeof id !== 'string' || id.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: id });
    return true;
  } catch {
    return false;
  }
}

/** A zone's offset at an instant: rounded whole minutes plus the lossless string. */
function offsetAt(instant: Instant, zoneId: string): { minutes: number; offset: string } {
  const zdt = Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds).toZonedDateTimeISO(
    zoneId,
  );
  // `zdt.offset` is lossless (`±HH:MM` or `±HH:MM:SS` for historical sub-minute
  // LMT offsets); the minute value is a rounded convenience for comparisons/chips.
  return { minutes: Math.round(zdt.offsetNanoseconds / 60_000_000_000), offset: zdt.offset };
}

/** Offset minutes (rounded) for a zone at local noon on a given month of a year. */
function offsetMinutesOnMonth(zoneId: string, year: number, month: number): number {
  const zdt = Temporal.PlainDateTime.from({ year, month, day: 1, hour: 12 }).toZonedDateTime(
    zoneId,
    { disambiguation: 'compatible' },
  );
  return Math.round(zdt.offsetNanoseconds / 60_000_000_000);
}

/**
 * Full offset / DST context for a zone at an instant.
 *
 * Daylight-saving state is derived from the offsets the zone actually uses across
 * the surrounding year, never from hard-coded rules: the standard offset is taken
 * to be the year's minimum, and the instant is "daylight" when its offset exceeds
 * it. We sample four fixed points AND fold in the instant's own offset, so a
 * transition that falls between the sample points (e.g. Ramadan clock changes,
 * which drift through the year) is not mistaken for a fixed zone. This is a
 * best-effort *appearance* — the numeric offset and IANA id remain authoritative
 * — and it is labelled as such.
 */
export function zoneOffsetInfo(instant: Instant, zoneId: string): ZoneOffsetInfo {
  const { minutes: offsetMinutes, offset } = offsetAt(instant, zoneId);
  const epochMs = instant.epochMilliseconds;

  const base = {
    zoneId,
    offsetMinutes,
    offset,
    abbreviation: zoneAbbreviation(zoneId, epochMs),
    longName: zoneLongName(zoneId, epochMs),
  };

  let year: number;
  try {
    year = Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds).toZonedDateTimeISO(
      zoneId,
    ).year;
  } catch {
    return { ...base, dst: 'unknown', dstShiftMinutes: 0 };
  }

  try {
    const samples = [
      offsetMinutes,
      ...[1, 4, 7, 10].map((m) => offsetMinutesOnMonth(zoneId, year, m)),
    ];
    const min = Math.min(...samples);
    const max = Math.max(...samples);
    if (min === max) {
      return { ...base, dst: 'fixed', dstShiftMinutes: 0 };
    }
    if (offsetMinutes > min) {
      return { ...base, dst: 'daylight', dstShiftMinutes: offsetMinutes - min };
    }
    return { ...base, dst: 'standard', dstShiftMinutes: 0 };
  } catch {
    return { ...base, dst: 'unknown', dstShiftMinutes: 0 };
  }
}
