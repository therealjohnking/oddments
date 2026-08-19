/**
 * Excel serial-date interpretation.
 *
 * Excel counts days from an epoch, with a famous wrinkle: the 1900 date system
 * treats 1900 as a leap year, inventing a fictitious `1900-02-29` at serial 60.
 * Every serial ≥ 61 is therefore shifted one day relative to a naïve count. Date
 * Goblin models this exactly:
 *
 *   • serials 1–59  → 1899-12-31 + n days   (before the phantom)
 *   • serial 60     → the fictitious 1900-02-29, reported as non-existent
 *   • serials ≥ 61  → 1899-12-31 + (n−1) days (skipping the phantom)
 *
 * The 1904 system (classic Mac Excel) has no phantom: serial 0 is 1904-01-01. We
 * never guess which system a number came from — it is an explicit choice.
 *
 * An Excel serial carries no time zone; the fractional part is a time of day. The
 * result is a wall-clock time, resolved against the selected zone downstream.
 */

import { Temporal, type TemporalTypes } from './temporal';
import { wallFromPlainDateTime } from './core';
import type { ExcelSystem, Recognition, WallDateTime } from './types';

const DAY_NS = 86_400n * 1_000_000_000n;

/** Round-half-up division of non-negative bigints. */
function roundDiv(numerator: bigint, denom: bigint): bigint {
  const q = numerator / denom;
  const r = numerator % denom;
  return r * 2n >= denom ? q + 1n : q;
}

function numericParts(raw: string): { negative: boolean; int: number; frac: string } | null {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(raw.trim());
  if (!match) return null;
  return { negative: match[1] === '-', int: Number(match[2]), frac: match[3] ?? '' };
}

/** Nanoseconds into the day for a fractional serial part (`0.xxxx`). */
function timeNanoseconds(frac: string): bigint {
  if (frac === '') return 0n;
  const combined = BigInt(frac);
  const denom = 10n ** BigInt(frac.length);
  const ns = roundDiv(combined * DAY_NS, denom);
  // The fractional part is a time strictly within the day: a value that rounds up
  // to a whole day must not carry into the next date (which, near serial 59/60,
  // would cross Excel's phantom leap day and mislabel the calendar date). Clamp to
  // the day's last nanosecond instead.
  return ns >= DAY_NS ? DAY_NS - 1n : ns;
}

/** Excel's maximum serial is 9999-12-31; beyond it the date is out of range. */
function ensureInRange(date: TemporalTypes.PlainDate): TemporalTypes.PlainDate {
  if (date.year > 9999 || date.year < 1) throw new RangeError('Excel date out of range');
  return date;
}

/** Build a wall time from an epoch `PlainDate` plus nanoseconds-into-day. */
function buildWall(date: TemporalTypes.PlainDate, timeNs: bigint): WallDateTime {
  let pdt = date.toPlainDateTime();
  if (timeNs > 0n) pdt = pdt.add({ nanoseconds: Number(timeNs) });
  return wallFromPlainDateTime(pdt);
}

export type ExcelParse =
  | { status: 'local'; wall: WallDateTime; recognition: Recognition }
  | { status: 'error'; error: { code: string; message: string; hint?: string } };

/** Interpret a decimal serial under a given Excel date system. */
export function parseExcel(raw: string, system: ExcelSystem): ExcelParse {
  const parts = numericParts(raw);
  if (!parts) {
    return {
      status: 'error',
      error: { code: 'not-numeric', message: 'An Excel serial date must be a plain number.' },
    };
  }
  const { negative, int, frac } = parts;
  const timeNs = timeNanoseconds(frac);

  if (system === '1904') {
    if (negative) {
      return {
        status: 'error',
        error: {
          code: 'excel-negative',
          message: 'Negative serials are not valid in the 1904 date system.',
          hint: 'The 1904 system starts at serial 0 = 1904-01-01.',
        },
      };
    }
    try {
      const date = ensureInRange(Temporal.PlainDate.from('1904-01-01').add({ days: int }));
      return {
        status: 'local',
        wall: buildWall(date, timeNs),
        recognition: {
          mode: 'excel',
          kind: 'local',
          summary: `Recognized as an Excel serial date (1904 system): serial ${int}${frac ? `.${frac}` : ''}.`,
          excelSystem: '1904',
          assumption: 'Excel serials carry no time zone; interpreted as a wall-clock time.',
        },
      };
    } catch {
      return outOfRange();
    }
  }

  // 1900 system.
  if (negative || int <= 0) {
    return {
      status: 'error',
      error: {
        code: int === 0 && !negative ? 'excel-zero' : 'excel-negative',
        message:
          int === 0 && !negative
            ? 'Serial 0 is Excel’s placeholder “1900-01-00”, not a real calendar day.'
            : 'Negative serials are not valid Excel dates.',
        hint: 'Excel’s 1900 system starts at serial 1 = 1900-01-01.',
      },
    };
  }

  if (int === 60) {
    return {
      status: 'error',
      error: {
        code: 'excel-phantom',
        message:
          'Excel serial 60 is the fictitious 1900-02-29 — a date Excel invented by wrongly treating 1900 as a leap year. It corresponds to no real day.',
        hint: 'Serial 59 is 1900-02-28; serial 61 is 1900-03-01.',
      },
    };
  }

  const adjusted = int >= 61 ? int - 1 : int;
  try {
    const date = ensureInRange(Temporal.PlainDate.from('1899-12-31').add({ days: adjusted }));
    const assumption =
      int >= 61
        ? 'Excel serials carry no time zone; interpreted as a wall-clock time. Serials ≥ 61 are shifted one day to skip Excel’s fictitious 1900-02-29.'
        : 'Excel serials carry no time zone; interpreted as a wall-clock time.';
    return {
      status: 'local',
      wall: buildWall(date, timeNs),
      recognition: {
        mode: 'excel',
        kind: 'local',
        summary: `Recognized as an Excel serial date (1900 system): serial ${int}${frac ? `.${frac}` : ''}.`,
        excelSystem: '1900',
        assumption,
      },
    };
  } catch {
    return outOfRange();
  }
}

function outOfRange(): ExcelParse {
  return {
    status: 'error',
    error: {
      code: 'out-of-range',
      message: 'That serial is outside the supported date range.',
      hint: 'Excel dates run to serial 2958465 (9999-12-31).',
    },
  };
}
