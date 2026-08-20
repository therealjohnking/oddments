/**
 * The workbench's practical limits, in one place so the UI messaging and the
 * engine agree. These are deliberate safeguards, not arbitrary caps: matching is
 * user-controlled work that can be pathological, so results are bounded, huge
 * inputs are flagged, and off-thread runs get a time budget.
 */

/** Maximum matches collected and displayed; beyond this the result is truncated. */
export const MATCH_CAP = 1000;

/** How long a single off-thread execution may run before the worker is stopped. */
export const WORKER_TIMEOUT_MS = 1500;

/** Test text at or above this length gets a gentle "large input" notice. */
export const LARGE_TEXT_WARN = 200_000;

/** Maximum UTF-16 length of text rendered in the highlighted view (DOM safety). */
export const HIGHLIGHT_TEXT_CAP = 100_000;
