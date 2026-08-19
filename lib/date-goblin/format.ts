/**
 * Deterministic formatting helpers and the small amount of `Intl` display glue.
 *
 * Correctness rule: everything the tool asserts as *fact* (weekday, month name,
 * offsets, labels) is produced here from fixed English tables and plain
 * arithmetic, so output never depends on the machine's locale. `Intl` is used
 * only for genuinely locale-ish *display* sugar — zone abbreviations and long
 * names — and always with a pinned `en-US` locale, clearly marked in the types as
 * non-authoritative.
 */

/** ISO weekday (1 = Mon … 7 = Sun) → full English name. Index 0 is unused. */
export const WEEKDAY_NAMES = [
  '',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

/** ISO weekday → short English name. */
export const WEEKDAY_SHORT = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Month (1–12) → full English name. Index 0 is unused. */
export const MONTH_NAMES = [
  '',
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Month (1–12) → short English name. */
export const MONTH_SHORT = [
  '',
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Zero-pad an integer to `width` digits (non-negative inputs). */
export function pad(value: number, width = 2): string {
  return String(value).padStart(width, '0');
}

/**
 * Format a signed offset in minutes as `±HH:MM`. `0` is `+00:00`. The sign is
 * always explicit — Date Goblin never renders an unsigned offset.
 */
export function formatOffset(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  return `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** A compact `±H`/`±H:MM` offset for chips, e.g. `-4`, `+5:30`, `UTC`. */
export function formatOffsetShort(minutes: number): string {
  if (minutes === 0) return 'UTC';
  const sign = minutes < 0 ? '-' : '+';
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return m === 0 ? `${sign}${h}` : `${sign}${h}:${pad(m)}`;
}

/** A deterministic, locale-independent human label for a wall clock. */
export function formatWallLabel(parts: {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  isoWeekday: number;
}): string {
  const wd = WEEKDAY_SHORT[parts.isoWeekday] ?? '';
  const mo = MONTH_SHORT[parts.month] ?? '';
  return `${wd}, ${mo} ${parts.day}, ${parts.year}, ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}

/** Group an integer with thin commas (matches the other tools' `formatInt`). */
export function formatInt(value: number): string {
  return value.toLocaleString('en-US');
}

/**
 * Exact epoch-seconds as a decimal string from full-precision nanoseconds, e.g.
 * `1786998240` or `1786998240.123456789`. Never invents precision: a whole-second
 * instant returns no fractional part. Handles negative sub-second correctly.
 */
export function epochSecondsDecimal(epochNanoseconds: bigint): string {
  const negative = epochNanoseconds < 0n;
  const abs = negative ? -epochNanoseconds : epochNanoseconds;
  const whole = abs / 1_000_000_000n;
  const frac = abs % 1_000_000_000n;
  const sign = negative ? '-' : '';
  if (frac === 0n) return `${sign}${whole}`;
  const fracStr = String(frac).padStart(9, '0').replace(/0+$/, '');
  return `${sign}${whole}.${fracStr}`;
}

/**
 * A short zone abbreviation for display (e.g. `EDT`, or an offset form like
 * `GMT-4` for zones without a customary abbreviation). Non-authoritative. Returns
 * `null` when the instant falls outside the range `Intl` can format.
 */
export function zoneAbbreviation(zoneId: string, epochMilliseconds: number): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zoneId,
      timeZoneName: 'short',
      year: 'numeric',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(epochMilliseconds);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}

/** The long zone name for display, e.g. `Eastern Daylight Time`. Non-authoritative. */
export function zoneLongName(zoneId: string, epochMilliseconds: number): string | null {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zoneId,
      timeZoneName: 'long',
      year: 'numeric',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(epochMilliseconds);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? null;
  } catch {
    return null;
  }
}
