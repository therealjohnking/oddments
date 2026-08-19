/**
 * The input parser. It turns raw text into one of five honest outcomes — an
 * instant, a local wall time, an "I won't guess" ambiguity, an error, or empty —
 * under an explicit mode or conservative auto-detection.
 *
 * Parsing philosophy (deliberately strict):
 *   • Never use `Date.parse` or any implementation-defined guessing.
 *   • Auto-detect only high-confidence shapes: extended ISO 8601 (with dashes),
 *     and bare numbers as Unix timestamps.
 *   • Refuse ambiguous locale formats like `03/04/26` — surface the ambiguity and
 *     ask for an ISO date or an explicit interpretation instead of guessing.
 */

import { Temporal } from './temporal';
import { instantFromTemporal, wallFromPlainDateTime } from './core';
import { parseExcel } from './excel';
import { parseUnix } from './unix';
import type {
  AmbiguityCandidate,
  ExcelSystem,
  InputMode,
  ParseResult,
  Recognition,
  UnixUnit,
  WallDateTime,
} from './types';

export interface ParseOptions {
  unixUnit?: UnixUnit;
  excelSystem?: ExcelSystem;
}

/**
 * Extended ISO 8601: dashes required in the date; time optional (seconds and
 * fraction optional); an optional trailing zone (`Z` or numeric offset). Basic
 * (separator-free) forms are intentionally excluded — they collide with Unix.
 */
// The `i` flag accepts RFC 3339's lowercase `t`/`z` designators (`2026-08-17t…z`);
// only the `T`/`Z` letters are affected, the digit groups are unchanged.
const ISO_RE =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:[.,](\d{1,9}))?)?)?(?:\s*(Z|[+-]\d{2}(?::?\d{2})?))?$/i;

const NUMERIC_RE = /^[+-]?\d+(?:\.\d+)?$/;

/** A slash/dot/dash-separated numeric date that is *not* ISO — inherently locale-ambiguous. */
const LOOSE_DATE_RE = /^(\d{1,4})[/.](\d{1,2})[/.](\d{1,4})$|^(\d{1,2})-(\d{1,2})-(\d{2,4})$/;

/** Normalise a zone designator to `Z` or `±HH:MM` (accepts lowercase `z`). */
function normalizeZone(zone: string): string {
  if (zone.toUpperCase() === 'Z') return 'Z';
  const m = /^([+-])(\d{2})(?::?(\d{2}))?$/.exec(zone);
  if (!m) return zone;
  return `${m[1]}${m[2]}:${m[3] ?? '00'}`;
}

/** Map a Temporal parse failure to a friendly, jargon-free message. */
function friendlyDateError(err: unknown): { code: string; message: string; hint?: string } {
  const raw = err instanceof Error ? err.message : '';
  if (/day/i.test(raw) || /month/i.test(raw)) {
    return {
      code: 'invalid-date',
      message: 'That calendar date does not exist (a day or month is out of range).',
    };
  }
  if (/hour|minute|second|time/i.test(raw)) {
    return { code: 'invalid-time', message: 'That time of day is not valid.' };
  }
  if (/range|bound/i.test(raw)) {
    return {
      code: 'out-of-range',
      message: 'That value is outside the supported date range.',
    };
  }
  return { code: 'malformed-iso', message: 'That does not look like a valid ISO 8601 date-time.' };
}

/**
 * Try to parse `raw` as ISO 8601. Returns a `ParseResult` when the input has an
 * ISO date shape (even if the specific value is invalid), or `null` when it does
 * not look like ISO at all (so auto-detection can try other formats).
 */
function tryParseIso(raw: string): ParseResult | null {
  const m = ISO_RE.exec(raw);
  if (!m) return null;

  const [, year, month, day, hour, minute, second, frac, zone] = m;
  const hasTime = hour !== undefined;

  // A `:60` second looks like a leap second. Temporal has no distinct instant for
  // one (it would silently constrain to `:59`), so rather than quietly shifting
  // the value we reject it explicitly — Date Goblin surfaces assumptions, never
  // hides them.
  if (second === '60') {
    return {
      status: 'error',
      error: {
        code: 'leap-second',
        message:
          'Second “:60” looks like a leap second, which has no distinct representable instant.',
        hint: 'Use “:59” or the following minute’s “:00”.',
      },
    };
  }

  const datePart = `${year}-${month}-${day}`;
  const timePart = hasTime
    ? `T${hour}:${minute}${second !== undefined ? `:${second}` : ':00'}${frac ? `.${frac}` : ''}`
    : '';

  // Zone present → an instant. A zone without a time is invalid.
  if (zone !== undefined) {
    if (!hasTime) {
      return {
        status: 'error',
        error: {
          code: 'malformed-iso',
          message: 'An offset or “Z” needs a time of day, e.g. 2026-08-17T00:00Z.',
        },
      };
    }
    const normZone = normalizeZone(zone);
    try {
      const inst = Temporal.Instant.from(`${datePart}${timePart}${normZone}`);
      const offsetLabel = normZone === 'Z' ? 'Z (UTC)' : normZone;
      const recognition: Recognition = {
        mode: 'iso',
        kind: 'instant',
        summary:
          normZone === 'Z'
            ? 'Recognized as ISO 8601 with Z (UTC).'
            : `Recognized as ISO 8601 with explicit UTC offset ${normZone}.`,
        sourceOffset: offsetLabel,
      };
      return { status: 'instant', instant: instantFromTemporal(inst), recognition };
    } catch (err) {
      return { status: 'error', error: friendlyDateError(err) };
    }
  }

  // No zone → a local wall time (or a date only).
  try {
    if (hasTime) {
      const pdt = Temporal.PlainDateTime.from(`${datePart}${timePart}`);
      const wall = wallFromPlainDateTime(pdt);
      const recognition: Recognition = {
        mode: 'iso',
        kind: 'local',
        summary: 'Recognized as a local (wall-clock) ISO date-time with no time zone.',
      };
      return { status: 'local', wall, recognition };
    }
    const date = Temporal.PlainDate.from(datePart);
    const wall: WallDateTime = wallFromPlainDateTime(date.toPlainDateTime());
    const recognition: Recognition = {
      mode: 'iso',
      kind: 'local',
      summary: 'Recognized as a calendar date with no time or zone.',
      assumption: 'No time of day was given; using 00:00:00.',
    };
    return { status: 'local', wall, recognition };
  } catch (err) {
    return { status: 'error', error: friendlyDateError(err) };
  }
}

/** Interpret an unzoned wall time typed under the explicit Local mode. */
function parseLocal(raw: string): ParseResult {
  const m = ISO_RE.exec(raw);
  if (m && m[8] !== undefined) {
    return {
      status: 'error',
      error: {
        code: 'local-has-zone',
        message: 'This value carries a zone or offset. Use Auto or ISO mode to honour it.',
        hint: 'Local mode is for wall-clock times with no zone, e.g. 2026-11-01 01:30.',
      },
    };
  }
  const iso = tryParseIso(raw);
  if (iso && iso.status === 'local') return iso;
  if (iso && iso.status === 'error') return iso;
  return {
    status: 'error',
    error: {
      code: 'malformed-local',
      message: 'Enter a wall-clock date-time like 2026-11-01 01:30 (ISO-style, no zone).',
    },
  };
}

/** Build candidate readings for a loose, non-ISO numeric date, when plausible. */
function looseDateCandidates(raw: string): AmbiguityCandidate[] {
  const m = LOOSE_DATE_RE.exec(raw);
  if (!m) return [];
  const groups = (m[1] !== undefined ? [m[1], m[2], m[3]] : [m[4], m[5], m[6]]).map((g) =>
    Number(g),
  );
  const [a, b, c] = groups as [number, number, number];
  const candidates: AmbiguityCandidate[] = [];
  const pushIf = (y: number, mo: number, d: number, label: string) => {
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      const iso = `${String(y).padStart(4, '0')}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      try {
        Temporal.PlainDate.from(iso);
        candidates.push({ label, preview: iso, detail: `Enter it as ${iso}` });
      } catch {
        /* not a real date */
      }
    }
  };
  if (String(a).length === 4) {
    pushIf(a, b, c, 'Year/month/day');
  } else {
    const year = c < 100 ? 2000 + c : c;
    pushIf(year, a, b, `Month/day/year (US): month ${a}`);
    pushIf(year, b, a, `Day/month/year: day ${a}`);
  }
  return candidates;
}

/** Auto-detect the most likely high-confidence interpretation. */
function autoDetect(raw: string, options: ParseOptions): ParseResult {
  // Bare number (not an ISO date) → Unix timestamp.
  if (NUMERIC_RE.test(raw) && !ISO_RE.test(raw)) {
    const unix = parseUnix(raw, options.unixUnit ?? 'auto');
    if (unix.status === 'error') return { status: 'error', error: unix.error };
    return unix;
  }

  const iso = tryParseIso(raw);
  if (iso) return iso;

  // Looks date-ish but is not ISO — refuse to guess, but help.
  const candidates = looseDateCandidates(raw);
  if (candidates.length > 0 || /[0-9]/.test(raw)) {
    return {
      status: 'ambiguous',
      message:
        'Ambiguous date format. This could represent more than one date, and Date Goblin will not guess from locale.',
      candidates,
      hint: 'Use an ISO-style date (YYYY-MM-DD), a Unix timestamp, or pick an explicit mode.',
    };
  }

  return {
    status: 'error',
    error: {
      code: 'unsupported',
      message: 'Date Goblin does not recognize this format.',
      hint: 'Try ISO 8601 (2026-08-17T20:24:00Z), a Unix timestamp, or an explicit mode.',
    },
  };
}

/** Parse raw input under a mode into a single, honest outcome. */
export function parseInput(raw: string, mode: InputMode, options: ParseOptions = {}): ParseResult {
  const trimmed = raw.trim();
  if (trimmed === '') return { status: 'empty' };

  switch (mode) {
    case 'unix': {
      const unix = parseUnix(trimmed, options.unixUnit ?? 'auto');
      return unix.status === 'error' ? { status: 'error', error: unix.error } : unix;
    }
    case 'excel': {
      const excel = parseExcel(trimmed, options.excelSystem ?? '1900');
      return excel.status === 'error' ? { status: 'error', error: excel.error } : excel;
    }
    case 'iso': {
      const iso = tryParseIso(trimmed);
      if (iso) return iso;
      return {
        status: 'error',
        error: {
          code: 'malformed-iso',
          message: 'That is not an ISO 8601 date-time.',
          hint: 'Example: 2026-08-17T20:24:00Z or 2026-08-17T16:24:00-04:00.',
        },
      };
    }
    case 'local':
      return parseLocal(trimmed);
    case 'auto':
    default:
      return autoDetect(trimmed, options);
  }
}
