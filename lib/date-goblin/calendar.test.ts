import { describe, expect, it } from 'vitest';
import { calendarFacts } from './calendar';
import { parseInput } from './parse';
import type { CalendarFacts } from './types';

/** Calendar facts for a UTC ISO instant, read in a zone (default UTC). */
function facts(isoUtc: string, zone = 'UTC'): CalendarFacts {
  const r = parseInput(isoUtc, 'iso');
  if (r.status !== 'instant') throw new Error(`not an instant: ${isoUtc}`);
  return calendarFacts(r.instant, zone);
}

describe('calendarFacts — ordinary date', () => {
  it('describes 2026-08-17', () => {
    const f = facts('2026-08-17T12:00:00Z');
    expect(f.weekdayName).toBe('Monday');
    expect(f.isoWeekday).toBe(1);
    expect(f.dayOfYear).toBe(229);
    expect(f.isoWeek).toBe(34);
    expect(f.isoWeekYear).toBe(2026);
    expect(f.quarter).toBe(3);
    expect(f.leapYear).toBe(false);
    expect(f.daysInMonth).toBe(31);
    expect(f.daysInYear).toBe(365);
  });
});

describe('calendarFacts — ISO week-year boundaries', () => {
  it('2027-01-01 belongs to ISO week 53 of 2026', () => {
    const f = facts('2027-01-01T00:00:00Z');
    expect(f.isoWeek).toBe(53);
    expect(f.isoWeekYear).toBe(2026);
    expect(f.year).toBe(2027);
    expect(f.dayOfYear).toBe(1);
  });

  it('2026-12-31 also belongs to ISO week 53 of 2026', () => {
    const f = facts('2026-12-31T00:00:00Z');
    expect(f.isoWeek).toBe(53);
    expect(f.isoWeekYear).toBe(2026);
    expect(f.dayOfYear).toBe(365);
  });

  it('2023-01-01 belongs to ISO week 52 of 2022', () => {
    const f = facts('2023-01-01T00:00:00Z');
    expect(f.isoWeek).toBe(52);
    expect(f.isoWeekYear).toBe(2022);
  });
});

describe('calendarFacts — leap years', () => {
  it('2024 is a leap year (2024-02-29 exists)', () => {
    const f = facts('2024-02-29T00:00:00Z');
    expect(f.leapYear).toBe(true);
    expect(f.daysInMonth).toBe(29);
    expect(f.daysInYear).toBe(366);
  });

  it('1900 is NOT a leap year (non-leap century)', () => {
    const f = facts('1900-03-01T00:00:00Z');
    expect(f.leapYear).toBe(false);
    expect(f.daysInYear).toBe(365);
    // Without a Feb 29, 1 March is day 60.
    expect(f.dayOfYear).toBe(60);
  });

  it('2000 IS a leap year (leap century)', () => {
    const f = facts('2000-02-29T00:00:00Z');
    expect(f.leapYear).toBe(true);
    expect(f.daysInMonth).toBe(29);
    expect(f.dayOfYear).toBe(60);
  });
});

describe('calendarFacts — day of year & zone relativity', () => {
  it('counts the last day of a leap year as 366', () => {
    expect(facts('2024-12-31T12:00:00Z').dayOfYear).toBe(366);
  });

  it('is computed relative to the requested zone', () => {
    // 2026-08-17T02:00Z is still 2026-08-16 in New York.
    const f = facts('2026-08-17T02:00:00Z', 'America/New_York');
    expect(f.day).toBe(16);
    expect(f.weekdayName).toBe('Sunday');
  });
});
