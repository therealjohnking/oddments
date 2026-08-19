/**
 * The single point where Date Goblin binds to a Temporal implementation.
 *
 * Temporal is a Stage-4 TC39 proposal but not yet everywhere: modern Chrome and
 * Firefox ship it, Node builds vary, and Safari (and the Vitest/jsdom runtime
 * this project tests under) still lack it. So we *prefer the native
 * implementation when the host provides one* and fall back to the spec-compliant
 * `temporal-polyfill` otherwise. Both implement the same specification, so
 * behaviour is identical; the fallback simply guarantees the tool works
 * cross-browser.
 *
 * Nothing outside `lib/date-goblin` imports `temporal-polyfill` or this module's
 * `Temporal` directly. The rest of the engine speaks Temporal internally but the
 * public API (see `index.ts`) returns only plain domain data — no Temporal object
 * ever reaches a React component. This is the "wrap the engine" boundary the
 * milestone asks for: swapping the temporal library would touch only this folder.
 */

import { Temporal as PolyfillTemporal } from 'temporal-polyfill';
import type { Temporal as TemporalNamespaceType } from 'temporal-polyfill';

// The Temporal *type* namespace, re-exported under a distinct name so the engine
// can annotate values (`TemporalTypes.PlainDateTime`) while importing the resolved
// *value* `Temporal` from this same module.
export type { TemporalNamespaceType as TemporalTypes };

type TemporalNamespace = typeof PolyfillTemporal;

const native = (globalThis as { Temporal?: TemporalNamespace }).Temporal;

/** Resolved Temporal implementation: native when the host provides it, else polyfill. */
export const Temporal: TemporalNamespace = native ?? PolyfillTemporal;

/** True when the host provided Temporal natively (informational only). */
export const usingNativeTemporal: boolean = native !== undefined;
