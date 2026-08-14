/**
 * Presentation helpers shared by the diagnostics, the report exporter, and the
 * React UI so numbers render identically everywhere. Locale is pinned to `en-US`
 * for deterministic output (and stable snapshot tests).
 */

/** Integer with thousands separators. */
export function formatInt(n: number): string {
  return Math.trunc(n).toLocaleString('en-US');
}

/** A 0..1 fraction as a percentage with at most one decimal place. */
export function formatPercent(fraction: number): string {
  const pct = fraction * 100;
  const rounded = Math.round(pct * 10) / 10;
  return Number.isInteger(rounded) ? `${rounded}%` : `${rounded.toFixed(1)}%`;
}

/** Human-readable byte size (B / KB / MB / GB). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[unit]}`;
}
