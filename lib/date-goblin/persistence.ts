/**
 * Browser-local persistence of *settings only*.
 *
 * The entered date/time is deliberately never stored — it may be sensitive
 * operational data — so a reload starts with a blank input. What is worth
 * remembering is the workspace: the preferred input mode, the last-used zone, the
 * comparison-zone shortlist, and the Excel/Unix preferences. Everything read back
 * is treated as untrusted and coerced leniently; a corrupt blob yields defaults
 * rather than a crash.
 */

import { isValidZone } from './zones';
import type { ExcelSystem, InputMode, UnixUnit } from './types';

export const STORAGE_KEY = 'oddments-date-goblin';
export const STORAGE_VERSION = 1;

/** Comparison zones are bounded — this is an instrument, not a world clock. */
export const MAX_COMPARISON_ZONES = 6;

export interface Settings {
  mode: InputMode;
  zone: string;
  comparisonZones: string[];
  excelSystem: ExcelSystem;
  unixUnit: UnixUnit;
}

const MODES: InputMode[] = ['auto', 'iso', 'unix', 'local', 'excel'];
const UNITS: UnixUnit[] = ['auto', 'seconds', 'milliseconds', 'microseconds', 'nanoseconds'];

export function defaultSettings(systemZone: string): Settings {
  return {
    mode: 'auto',
    zone: systemZone,
    comparisonZones: [],
    excelSystem: '1900',
    unixUnit: 'auto',
  };
}

/** Serialize settings to a versioned JSON string. */
export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: STORAGE_VERSION, ...settings });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Parse a stored blob into settings, filling anything missing or invalid from
 * `defaults`. Returns `null` only when there is nothing usable to read.
 */
export function deserializeSettings(raw: string | null, defaults: Settings): Settings | null {
  if (raw === null || raw === '') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== STORAGE_VERSION) return null;

  const mode =
    typeof parsed.mode === 'string' && (MODES as string[]).includes(parsed.mode)
      ? (parsed.mode as InputMode)
      : defaults.mode;
  const zone =
    typeof parsed.zone === 'string' && isValidZone(parsed.zone) ? parsed.zone : defaults.zone;
  const excelSystem = parsed.excelSystem === '1904' ? '1904' : '1900';
  const unixUnit =
    typeof parsed.unixUnit === 'string' && (UNITS as string[]).includes(parsed.unixUnit)
      ? (parsed.unixUnit as UnixUnit)
      : defaults.unixUnit;

  const comparisonZones: string[] = [];
  if (Array.isArray(parsed.comparisonZones)) {
    for (const entry of parsed.comparisonZones) {
      if (
        typeof entry === 'string' &&
        isValidZone(entry) &&
        !comparisonZones.includes(entry) &&
        comparisonZones.length < MAX_COMPARISON_ZONES
      ) {
        comparisonZones.push(entry);
      }
    }
  }

  return { mode, zone, comparisonZones, excelSystem, unixUnit };
}

/** Read settings from localStorage, or `null` if none/unusable/blocked. */
export function loadSettings(defaults: Settings): Settings | null {
  try {
    return deserializeSettings(localStorage.getItem(STORAGE_KEY), defaults);
  } catch {
    return null;
  }
}

/** Persist settings; failures (quota, private mode) are ignored. */
export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSettings(settings));
  } catch {
    // Nothing to do — settings simply won't be remembered.
  }
}
