/**
 * Browser-local persistence of *preferences only*.
 *
 * The Markdown source and every generated output are deliberately never stored —
 * they may be proprietary, personal, or sensitive — so a reload starts with a
 * blank workbench. What is worth remembering is the workspace: the last-selected
 * destination and the table-layout preference. Everything read back is treated as
 * untrusted and coerced leniently; a corrupt blob yields defaults, not a crash.
 */

import type { Destination, TableLayout } from './types';

export const STORAGE_KEY = 'oddments-pastewright';
export const STORAGE_VERSION = 1;

export interface Settings {
  destination: Destination;
  tableLayout: TableLayout;
}

const DESTINATIONS: Destination[] = ['rich', 'linkedin', 'slack', 'reddit', 'plain'];
const LAYOUTS: TableLayout[] = ['auto', 'aligned', 'records'];

export function defaultSettings(): Settings {
  return { destination: 'rich', tableLayout: 'auto' };
}

export function serializeSettings(settings: Settings): string {
  return JSON.stringify({ version: STORAGE_VERSION, ...settings });
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

  const destination =
    typeof parsed.destination === 'string' &&
    (DESTINATIONS as string[]).includes(parsed.destination)
      ? (parsed.destination as Destination)
      : defaults.destination;
  const tableLayout =
    typeof parsed.tableLayout === 'string' && (LAYOUTS as string[]).includes(parsed.tableLayout)
      ? (parsed.tableLayout as TableLayout)
      : defaults.tableLayout;

  return { destination, tableLayout };
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
    // Nothing to do — preferences simply won't be remembered.
  }
}
