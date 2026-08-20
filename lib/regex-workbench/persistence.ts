/**
 * Browser-local persistence of *settings only*.
 *
 * The pattern, the test text, and the replacement string are deliberately never
 * stored — any of them may be proprietary or sensitive — so a reload starts with
 * a blank workbench. What is worth remembering is the workspace preference: the
 * selected flags. Everything read back is treated as untrusted and coerced
 * leniently; a corrupt blob yields defaults rather than a crash.
 */

import { canonicalizeFlags } from './flags';

export const STORAGE_KEY = 'oddments-regex-workbench';
export const STORAGE_VERSION = 1;

export interface Settings {
  flags: string;
}

export function defaultSettings(): Settings {
  return { flags: 'g' };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: STORAGE_VERSION, flags: settings.flags });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

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
  const flags = typeof parsed.flags === 'string' ? canonicalizeFlags(parsed.flags) : defaults.flags;
  return { flags };
}

export function loadSettings(defaults: Settings): Settings | null {
  try {
    return deserializeSettings(localStorage.getItem(STORAGE_KEY), defaults);
  } catch {
    return null;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeSettings(settings));
  } catch {
    // Nothing to do — settings simply won't be remembered.
  }
}
