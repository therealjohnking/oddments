/**
 * Deterministic calendar facts for a resolved instant, computed in a chosen zone
 * (weekday, day-of-year, and week number are all zone-relative).
 *
 * ISO week and ISO week-year are derived from first principles via Temporal date
 * arithmetic rather than a locale-sensitive getter, so the notorious year-boundary
 * cases are exact: 2027-01-01 belongs to ISO week 53 of 2026, and 2026-12-31 does
 * too. Weekday and month *names* come from fixed English tables (never `Intl`), so
 * the facts never shift with the machine's locale.
 */

import { Temporal, type TemporalTypes } from './temporal';
import { MONTH_NAMES, WEEKDAY_NAMES } from './format';
import type { CalendarFacts, Instant } from './types';

/** ISO week number and ISO week-numbering year for a date. */
export function isoWeek(date: TemporalTypes.PlainDate): { week: number; weekYear: number } {
  // The ISO week-year is the year of the Thursday in the same ISO week.
  const thursday = date.add({ days: 4 - date.dayOfWeek });
  const week = Math.floor((thursday.dayOfYear - 1) / 7) + 1;
  return { week, weekYear: thursday.year };
}

/** Compute calendar facts for an instant as read in `zoneId`. */
export function calendarFacts(instant: Instant, zoneId: string): CalendarFacts {
  const zdt = Temporal.Instant.fromEpochNanoseconds(instant.epochNanoseconds).toZonedDateTimeISO(
    zoneId,
  );
  const date = zdt.toPlainDate();
  const { week, weekYear } = isoWeek(date);
  const isoWeekday = zdt.dayOfWeek;
  return {
    zoneId,
    year: zdt.year,
    month: zdt.month,
    day: zdt.day,
    isoWeekday,
    weekdayName: WEEKDAY_NAMES[isoWeekday] ?? '',
    monthName: MONTH_NAMES[zdt.month] ?? '',
    dayOfYear: zdt.dayOfYear,
    isoWeek: week,
    isoWeekYear: weekYear,
    quarter: Math.floor((zdt.month - 1) / 3) + 1,
    leapYear: zdt.inLeapYear,
    daysInMonth: zdt.daysInMonth,
    daysInYear: zdt.daysInYear,
  };
}
