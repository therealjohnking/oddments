/**
 * Conservative value- and column-level type inference for CSV Autopsy.
 *
 * Two hard rules govern everything here:
 *
 *  1. Inference is a *hint*, never a schema. When a column is 99% numeric with a
 *     handful of stragglers, we keep the dominant type and report the stragglers
 *     as anomalies — that is far more useful than flatly calling the column
 *     "text" or pretending the stragglers are numbers.
 *
 *  2. Ambiguity defaults to caution. Unambiguous ISO-style dates are recognized;
 *     locale-ambiguous forms like `03/04/2026` (is that March or April?) are left
 *     as text on purpose, because guessing would invent information.
 *
 * Everything is pure and deterministic — the same value always classifies the
 * same way, with no locale or clock dependence.
 */

import type { ColumnType, ValueType, CellClass, TypeBreakdown } from './types';

/**
 * Text tokens treated as "null-like" and counted as effectively blank. The set
 * is deliberately small and case-sensitive-ish (we match the trimmed value
 * exactly). Ambiguous values such as `0`, `No`, or `Unknown` are NOT included —
 * they are real data far more often than they are missing.
 */
export const NULL_LIKE_TOKENS: readonly string[] = [
  'NULL',
  'null',
  'Null',
  'N/A',
  'NA',
  'n/a',
  'None',
  '-',
];
const NULL_LIKE = new Set(NULL_LIKE_TOKENS);

/** Case-insensitive tokens that unambiguously read as booleans at the value level. */
const BOOLEAN_TOKENS = new Set(['true', 'false', 'yes', 'no']);

/**
 * The wider set a *whole column* may be built from to be recognized as boolean.
 * `0`/`1` and `y`/`n` are only ever read as boolean when the entire column is
 * one of at most two such tokens — never for an individual value (a lone `1` is
 * an integer, a lone `y` is text).
 */
const BOOLEAN_COLUMN_TOKENS = new Set(['true', 'false', 'yes', 'no', 'y', 'n', 't', 'f', '0', '1']);

/** Share of populated cells a single type family must reach to become the dominant type. */
export const TYPE_DOMINANCE = 0.85;
/** Share of populated cells that must be free text before a column is called "text". */
export const TEXT_DOMINANCE = 0.7;

export interface NumericParse {
  value: number;
  /** True when the source was written in integer form (no point, no exponent, not a percent). */
  isInteger: boolean;
  /** True when the value was only accepted after stripping grouping / currency / percent. */
  formatted: boolean;
}

const PLAIN_INT = /^[+-]?\d+$/;
const PLAIN_DEC = /^[+-]?(?:\d+\.\d+|\.\d+)$/;
const SCIENTIFIC = /^[+-]?\d+(?:\.\d+)?[eE][+-]?\d+$/;
const GROUPED_INT = /^[+-]?\d{1,3}(?:,\d{3})+$/;
const GROUPED_DEC = /^[+-]?\d{1,3}(?:,\d{3})+\.\d+$/;
const CURRENCY = /[$€£¥₹]/g;

function parsePlainNumber(
  s: string,
): { value: number; isInteger: boolean; formatted: boolean } | null {
  if (PLAIN_INT.test(s)) return { value: Number(s), isInteger: true, formatted: false };
  if (PLAIN_DEC.test(s)) return { value: Number(s), isInteger: false, formatted: false };
  if (SCIENTIFIC.test(s)) return { value: Number(s), isInteger: false, formatted: false };
  if (GROUPED_INT.test(s))
    return { value: Number(s.replace(/,/g, '')), isInteger: true, formatted: true };
  if (GROUPED_DEC.test(s))
    return { value: Number(s.replace(/,/g, '')), isInteger: false, formatted: true };
  return null;
}

/**
 * Parse a value as a number if it *conservatively* looks like one. Accepts plain
 * integers/decimals, scientific notation, thousands-grouped numbers, a single
 * leading currency symbol, and a trailing percent sign. Anything else (a stray
 * letter, two decimal points, a bare dash) is left for `text`.
 */
export function parseNumericLike(trimmed: string): NumericParse | null {
  const direct = parsePlainNumber(trimmed);
  if (direct) return direct;

  // Decorated forms: an optional leading currency symbol and/or a trailing '%'.
  let core = trimmed;
  let formatted = false;
  let percent = false;

  if (core.endsWith('%')) {
    percent = true;
    formatted = true;
    core = core.slice(0, -1).trimEnd();
  }

  if (CURRENCY.test(core)) {
    // Allow the symbol only adjacent to the number, with an optional sign in front.
    const stripped = core.replace(CURRENCY, '');
    if (stripped !== core) {
      formatted = true;
      core = stripped.replace(/^([+-])\s+/, '$1').trim();
    }
  }

  if (!formatted) return null;
  const inner = parsePlainNumber(core);
  if (!inner) return null;
  // A percent or currency amount is reported as a decimal magnitude, not an integer.
  return { value: inner.value, isInteger: inner.isInteger && !percent, formatted };
}

function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function validYmd(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12 || d < 1) return false;
  const max = m === 2 && isLeapYear(y) ? 29 : DAYS_IN_MONTH[m - 1]!;
  return d <= max;
}

export interface DateParse {
  /** Sortable instant (epoch ms, UTC) — used only for min/max ordering. */
  time: number;
  hasTime: boolean;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const YMD_SLASH = /^(\d{4})\/(\d{2})\/(\d{2})$/;
const ISO_DATETIME =
  /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;

/**
 * Recognize a date/datetime *only* when the format is unambiguous. ISO dates and
 * datetimes, plus the year-first `YYYY/MM/DD` slash form, qualify. Locale forms
 * like `MM/DD/YYYY` or `DD-MM-YYYY` are intentionally rejected — see the module
 * note. Returns null for anything not confidently a date.
 */
export function parseDateLike(trimmed: string): DateParse | null {
  const iso = ISO_DATE.exec(trimmed) ?? YMD_SLASH.exec(trimmed);
  if (iso) {
    const y = Number(iso[1]);
    const m = Number(iso[2]);
    const d = Number(iso[3]);
    if (!validYmd(y, m, d)) return null;
    return { time: Date.UTC(y, m - 1, d), hasTime: false };
  }

  const dt = ISO_DATETIME.exec(trimmed);
  if (dt) {
    const y = Number(dt[1]);
    const m = Number(dt[2]);
    const d = Number(dt[3]);
    const hh = Number(dt[4]);
    const mm = Number(dt[5]);
    const ss = dt[6] === undefined ? 0 : Number(dt[6]);
    if (!validYmd(y, m, d) || hh > 23 || mm > 59 || ss > 59) return null;
    const parsed = Date.parse(trimmed.replace(' ', 'T'));
    if (Number.isNaN(parsed)) return null;
    return { time: parsed, hasTime: true };
  }

  return null;
}

/** Classify a single populated (already-trimmed, non-blank) value. */
export function classifyValue(trimmed: string): ValueType {
  if (BOOLEAN_TOKENS.has(trimmed.toLowerCase())) return 'boolean';
  const numeric = parseNumericLike(trimmed);
  if (numeric) return numeric.isInteger ? 'integer' : 'decimal';
  const date = parseDateLike(trimmed);
  if (date) return date.hasTime ? 'datetime' : 'date';
  return 'text';
}

/** Classify any raw cell: the blank kinds first, then the value type. */
export function classifyCell(raw: string): CellClass {
  if (raw.length === 0) return 'empty';
  const trimmed = raw.trim();
  if (trimmed.length === 0) return 'whitespace';
  if (NULL_LIKE.has(trimmed)) return 'null-like';
  return classifyValue(trimmed);
}

export function isNullLike(trimmed: string): boolean {
  return NULL_LIKE.has(trimmed);
}

/** True when a cell class is one of the "effectively blank" kinds. */
export function isBlankClass(cls: CellClass): boolean {
  return cls === 'empty' || cls === 'whitespace' || cls === 'null-like';
}

export interface DominantResult {
  type: ColumnType;
  /** Fraction of populated cells matching the dominant family (0..1). */
  conformity: number;
  /** Populated cells belonging to the dominant family. */
  familyCount: number;
}

/**
 * Resolve a column's dominant type from its per-value tally. `booleanShape` is
 * decided by the caller (the whole column is one/two boolean-ish tokens) and
 * wins outright. Otherwise the largest type *family* — numeric (int+decimal),
 * temporal (date+datetime), boolean, or text — decides, subject to a dominance
 * threshold; failing that, the column is "mixed".
 */
export function resolveDominantType(
  breakdown: TypeBreakdown,
  populated: number,
  booleanShape: boolean,
): DominantResult {
  if (populated === 0) return { type: 'empty', conformity: 1, familyCount: 0 };
  if (booleanShape) return { type: 'boolean', conformity: 1, familyCount: populated };

  const numeric = breakdown.integer + breakdown.decimal;
  const temporal = breakdown.date + breakdown.datetime;
  const boolean = breakdown.boolean;
  const text = breakdown.text;

  const families: { type: ColumnType; count: number }[] = [
    { type: breakdown.decimal > 0 ? 'decimal' : 'integer', count: numeric },
    { type: breakdown.datetime > 0 ? 'datetime' : 'date', count: temporal },
    { type: 'boolean', count: boolean },
    { type: 'text', count: text },
  ];
  families.sort((a, b) => b.count - a.count);
  const top = families[0]!;
  const share = top.count / populated;

  if (top.type === 'text') {
    if (share >= TEXT_DOMINANCE) return { type: 'text', conformity: share, familyCount: text };
    return { type: 'mixed', conformity: share, familyCount: top.count };
  }
  if (share >= TYPE_DOMINANCE) {
    return { type: top.type, conformity: share, familyCount: top.count };
  }
  // A non-text family leads but not decisively, and text is not dominant either.
  if (text / populated >= TEXT_DOMINANCE) {
    return { type: 'text', conformity: text / populated, familyCount: text };
  }
  return { type: 'mixed', conformity: share, familyCount: top.count };
}

/**
 * Decide whether a set of distinct populated values (already lowercased) is a
 * boolean column: at most two distinct tokens, all drawn from the boolean-column
 * vocabulary, and not a single constant (a lone `y` everywhere is constant, not
 * boolean).
 */
export function isBooleanColumnShape(distinctLower: Set<string>): boolean {
  if (distinctLower.size < 2 || distinctLower.size > 2) return false;
  for (const v of distinctLower) {
    if (!BOOLEAN_COLUMN_TOKENS.has(v)) return false;
  }
  return true;
}
