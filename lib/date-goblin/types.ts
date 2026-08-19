/**
 * Domain types for Date Goblin — a local-first date/time interpretation and
 * conversion instrument.
 *
 * The engine's central distinction, surfaced everywhere in these types:
 *
 *   • An **instant** is a unique point on the global timeline (a Unix timestamp,
 *     or an ISO string carrying `Z`/an explicit offset). It already identifies a
 *     moment; a time zone only changes how it is *displayed*.
 *   • A **local (wall-clock) date-time** is what a clock on a wall reads. It does
 *     not identify an instant until a time zone is applied — and that application
 *     can be *ambiguous* (a clock reading that occurs twice at a fall-back) or
 *     *nonexistent* (one skipped by a spring-forward).
 *
 * Every type here is plain, serialisable data: no Temporal objects, no library
 * types. `epochNanoseconds` is a native `bigint` (the only faithful full-precision
 * carrier); everything else is a number or string. Offsets are **signed minutes
 * east of UTC** — the sign is part of the value, never implied.
 */

/** The interpretation mode chosen by the user (or `auto`-detected). */
export type InputMode = 'auto' | 'iso' | 'unix' | 'local' | 'excel';

/** Whether a recognised input pins an instant outright or needs a zone first. */
export type SourceKind = 'instant' | 'local';

/** The unit of a Unix timestamp. `auto` lets the engine infer from magnitude. */
export type UnixUnit = 'auto' | 'seconds' | 'milliseconds' | 'microseconds' | 'nanoseconds';

/** Which Excel serial-date epoch to use. */
export type ExcelSystem = '1900' | '1904';

/* ── Instants & wall times ───────────────────────────────────────────────── */

/** A unique moment on the global timeline, engine-independent. */
export interface Instant {
  /** Full-precision nanoseconds since the Unix epoch — the authoritative value. */
  epochNanoseconds: bigint;
  /** Milliseconds since the epoch (exact within the supported ±10⁸-day range). */
  epochMilliseconds: number;
  /** Whole seconds since the epoch (floored toward −∞ for sub-second values). */
  epochSeconds: number;
  /** Canonical ISO 8601 in UTC, e.g. `2026-08-17T20:24:00Z`. */
  iso: string;
  /** True when the value carries sub-second precision. */
  hasSubsecond: boolean;
}

/** A wall-clock date-time with no zone attached. */
export interface WallDateTime {
  year: number;
  /** 1–12. */
  month: number;
  /** 1–31. */
  day: number;
  /** 0–23. */
  hour: number;
  /** 0–59. */
  minute: number;
  /** 0–59. */
  second: number;
  /** 0–999,999,999 nanoseconds within the second. */
  nanosecond: number;
  /** ISO-ish rendering without any zone, e.g. `2026-11-01T01:30:00`. */
  iso: string;
}

/** How one instant reads in one particular zone. */
export interface ZonedReading {
  /** IANA identifier (or `UTC`) — authoritative alongside the numeric offset. */
  zoneId: string;
  /** The wall clock in this zone. */
  wall: WallDateTime;
  /** Signed minutes east of UTC (e.g. −240 for −04:00, +330 for +05:30). */
  offsetMinutes: number;
  /** Formatted offset, e.g. `-04:00`, `+05:30`, `+00:00`. */
  offset: string;
  /**
   * A short zone abbreviation for display only (e.g. `EDT`) — may itself be an
   * offset form like `GMT-4` for zones without a customary abbreviation. Never
   * treat this as authoritative; the zone id + numeric offset are.
   */
  abbreviation: string | null;
  /** The long zone name for display, e.g. `Eastern Daylight Time`. */
  longName: string | null;
  /** ISO 8601 with the zone offset, e.g. `2026-08-17T16:24:00-04:00`. */
  iso: string;
  /** Deterministic human label, e.g. `Mon, Aug 17, 2026, 16:24:00`. */
  label: string;
}

/** An instant paired with how it reads in a chosen zone. */
export interface InstantReading {
  instant: Instant;
  reading: ZonedReading;
}

/** Daylight-saving / offset context for a zone at a given instant. */
export interface ZoneOffsetInfo {
  zoneId: string;
  offsetMinutes: number;
  offset: string;
  abbreviation: string | null;
  longName: string | null;
  /**
   * `fixed`   — the zone used a single offset all year (no DST observed).
   * `daylight`— the offset is larger than the zone's standard offset this year.
   * `standard`— the zone observes DST, but this instant is on standard time.
   * `unknown` — could not be determined reliably.
   */
  dst: 'fixed' | 'daylight' | 'standard' | 'unknown';
  /** Minutes the current offset differs from the zone's standard offset (≥ 0). */
  dstShiftMinutes: number;
}

/* ── Resolving a wall time in a zone ─────────────────────────────────────── */

/**
 * The result of applying a zone to a wall-clock time.
 *   • `unique`    — one instant; the ordinary case.
 *   • `ambiguous` — a fall-back fold; the clock reading occurs twice. Two valid
 *                   instants (`earlier`, `later`) share the same wall clock.
 *   • `gap`       — a spring-forward gap; the wall clock never occurs. `before`
 *                   and `after` are the two nearest real instants (the requested
 *                   time projected with the pre- and post-transition offsets).
 */
export type Resolution =
  | { kind: 'unique'; reading: InstantReading }
  | {
      kind: 'ambiguous';
      earlier: InstantReading;
      later: InstantReading;
      /** Minutes the offset falls back by (e.g. 60 for a one-hour fold). */
      shiftMinutes: number;
    }
  | {
      kind: 'gap';
      /** Requested wall time (which does not exist in this zone). */
      requested: WallDateTime;
      /** Interpreting with the pre-jump offset (reads earlier than requested). */
      before: InstantReading;
      /** Interpreting with the post-jump offset (reads later than requested). */
      after: InstantReading;
      /** Minutes skipped by the spring-forward (e.g. 60). */
      gapMinutes: number;
      /** Wall clock the jump leaves from, e.g. `02:00`. */
      gapStartLabel: string;
      /** Wall clock the jump lands on, e.g. `03:00`. */
      gapEndLabel: string;
    };

/* ── Parsing ─────────────────────────────────────────────────────────────── */

/** What the parser recognised about the raw input, for the interpretation note. */
export interface Recognition {
  /** The mode actually used (after `auto` resolves to a concrete one). */
  mode: Exclude<InputMode, 'auto'>;
  /** Whether the source pins an instant or is a wall time needing a zone. */
  kind: SourceKind;
  /** One-line, plain-language description of what was recognised. */
  summary: string;
  /** For instant inputs: the offset the source itself carried, if any. */
  sourceOffset?: string;
  /** For Unix inputs: the unit used. */
  unixUnit?: Exclude<UnixUnit, 'auto'>;
  /** For Excel inputs: the serial system used. */
  excelSystem?: ExcelSystem;
  /** True when a zone or unit had to be assumed rather than read from input. */
  assumption?: string;
}

/** A precise, recoverable parse failure (never a raw library message). */
export interface ParseError {
  /** Stable machine code, e.g. `malformed-iso`, `out-of-range`. */
  code: string;
  /** Plain-language message. */
  message: string;
  /** Optional concrete hint on how to make the input parseable. */
  hint?: string;
}

/**
 * The outcome of parsing raw input under a mode. `instant` and `local` are the
 * two successes; the rest are honest non-results the UI renders as guidance.
 */
export type ParseResult =
  | { status: 'empty' }
  | { status: 'instant'; instant: Instant; recognition: Recognition }
  | { status: 'local'; wall: WallDateTime; recognition: Recognition }
  | {
      /** The input might mean more than one thing; we refuse to guess. */
      status: 'ambiguous';
      message: string;
      /** Candidate interpretations to show, each self-describing. */
      candidates: AmbiguityCandidate[];
      hint?: string;
    }
  | { status: 'error'; error: ParseError };

/** One interpretation offered when the parser declines to guess. */
export interface AmbiguityCandidate {
  /** Short label, e.g. `As Unix seconds` or `Month/day: March 4`. */
  label: string;
  /** The resulting date-time in ISO form, for preview. */
  preview: string;
  /** The explicit mode/unit that would select this reading. */
  detail: string;
}

/* ── Findings (ambiguity & quirk explanations) ───────────────────────────── */

export type FindingSeverity = 'info' | 'notice' | 'warning';

/** Numeric ordering so findings sort most-severe first. */
export const SEVERITY_RANK: Record<FindingSeverity, number> = {
  warning: 2,
  notice: 1,
  info: 0,
};

export type FindingCategory =
  'dst' | 'unit' | 'excel' | 'precision' | 'range' | 'assumption' | 'instant-vs-local';

/** A single explanation surfaced beside the conversion. */
export interface Finding {
  id: string;
  severity: FindingSeverity;
  category: FindingCategory;
  title: string;
  /** Plain-language description, already interpolated with concrete values. */
  detail: string;
}

/* ── Calendar facts ──────────────────────────────────────────────────────── */

/** Deterministic calendar facts for a date in a particular zone. */
export interface CalendarFacts {
  /** The zone these facts are computed in (facts like weekday are zone-relative). */
  zoneId: string;
  /** Calendar year. */
  year: number;
  month: number;
  day: number;
  /** 1 = Monday … 7 = Sunday (ISO). */
  isoWeekday: number;
  /** English weekday name, e.g. `Monday`. */
  weekdayName: string;
  /** English month name, e.g. `August`. */
  monthName: string;
  /** 1-based day of the year (1–366). */
  dayOfYear: number;
  /** ISO 8601 week number (1–53). */
  isoWeek: number;
  /** ISO 8601 week-numbering year (can differ from `year` near Jan 1 / Dec 31). */
  isoWeekYear: number;
  /** Calendar quarter, 1–4. */
  quarter: number;
  /** Whether `year` is a Gregorian leap year. */
  leapYear: boolean;
  /** Number of days in `month` (28–31). */
  daysInMonth: number;
  /** Number of days in `year` (365 or 366). */
  daysInYear: number;
}

/* ── JavaScript-range note ───────────────────────────────────────────────── */

/** Whether an instant fits inside the supported temporal range. */
export interface RangeInfo {
  /** Fits within ±10⁸ days (the shared JS `Date` / `Temporal.Instant` range). */
  inSupportedRange: boolean;
  /** True when representable exactly as a JS `Date` (same ±10⁸-day bound). */
  fitsJsDate: boolean;
}

/* ── Relative time ───────────────────────────────────────────────────────── */

/** A human comparison to "now" (computed client-side against a passed-in now). */
export interface RelativeTime {
  /** e.g. `3 hours ago`, `in 12 days`, `just now`. */
  text: string;
  /** Signed milliseconds from now (negative = past). */
  deltaMilliseconds: number;
  /** True when |delta| < 1 minute. */
  withinMinute: boolean;
}
