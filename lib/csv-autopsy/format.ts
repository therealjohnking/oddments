/**
 * Presentation helpers shared by the report exporter and the React UI, so both
 * render numbers the same way. Locale is pinned to `en-US` for deterministic
 * output across environments (and stable snapshot tests).
 *
 * The guiding rule is *no floating-point presentation noise*: a mean of
 * 12.100000000000001 renders as `12.1`, not its binary artifact.
 */

/** Format a number with thousands separators, trimming float noise to ≤4 decimals. */
export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  if (Number.isInteger(n)) return n.toLocaleString('en-US');

  const rounded = Number(n.toFixed(4));
  if (Number.isInteger(rounded)) return rounded.toLocaleString('en-US');

  const negative = rounded < 0;
  const abs = Math.abs(rounded);
  const str = abs.toString();
  const dot = str.indexOf('.');
  const intPart = dot === -1 ? str : str.slice(0, dot);
  const fracPart = dot === -1 ? '' : str.slice(dot + 1);
  const grouped = Number(intPart).toLocaleString('en-US');
  return `${negative ? '-' : ''}${grouped}${fracPart ? `.${fracPart}` : ''}`;
}

/** Format a 0..1 fraction as a percentage with at most one decimal place. */
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
