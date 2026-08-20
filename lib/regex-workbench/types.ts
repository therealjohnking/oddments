/**
 * Shared domain types for Regex Workbench.
 *
 * Everything here is plain, serialisable data: no `RegExp` object, no third-party
 * AST node, and no React type ever crosses this boundary. The engine's job is to
 * turn a pattern + flags + text into these structures; the UI's job is to render
 * them. Keeping the seam this clean is what lets the match executor run inside a
 * Web Worker (structured-clone only) and lets every rule be unit-tested without a
 * DOM.
 *
 * This workbench targets the **JavaScript / ECMAScript `RegExp`** engine only.
 * Regex syntax and semantics vary by engine; none of these types imply otherwise.
 */

import type { LineCol } from './positions';

// ── Flags ────────────────────────────────────────────────────────────────────

/** The eight ECMAScript `RegExp` flags, in canonical order `dgimsuvy`. */
export type FlagId = 'd' | 'g' | 'i' | 'm' | 's' | 'u' | 'v' | 'y';

export interface FlagMeta {
  id: FlagId;
  /** Full name, e.g. "global". */
  name: string;
  /** One-line explanation of what the flag does. */
  summary: string;
  /** Whether the current runtime actually supports the flag. */
  supported: boolean;
}

// ── Compilation ──────────────────────────────────────────────────────────────

export interface CompileOk {
  ok: true;
  /** The pattern body exactly as entered. */
  source: string;
  /** Canonical, de-duplicated user flags (canonical order). */
  flags: string;
  /**
   * Flags actually used to execute. This is `flags` plus `d` (match indices) when
   * the runtime supports it, so capture-group positions can be reported. `d` is
   * purely additive — it never changes what matches — so this stays faithful to
   * the user's regex while recovering group ranges.
   */
  execFlags: string;
  /** Number of capturing groups (numbered 1..n). */
  groupCount: number;
  /** Declared named-group names, in source order. */
  groupNames: string[];
  /** One entry per capturing group in numbering order: its name, or null. */
  groupNamesByNumber: (string | null)[];
  /** True when the pattern can match the empty string (derived from the AST). */
  canMatchEmpty: boolean;
}

export interface CompileError {
  ok: false;
  source: string;
  flags: string;
  /** The native `RegExp` error message, lightly cleaned — never a stack trace. */
  message: string;
  /** An optional, conservative hint; never claims a more precise location than the engine gives. */
  hint?: string;
}

export type CompileResult = CompileOk | CompileError;

/** Result of parsing a pasted `/body/flags` literal as an import convenience. */
export interface LiteralParse {
  body: string;
  flags: string;
}

// ── Matching ─────────────────────────────────────────────────────────────────

/** One capture group within a match. */
export interface GroupCapture {
  /** 1-based group number. */
  number: number;
  /** The group's name, or null for an unnamed group. */
  name: string | null;
  /**
   * Captured text. `null` means the group did **not participate** in the match;
   * `''` means it participated and captured the empty string. These are different.
   */
  value: string | null;
  /** UTF-16 start offset, or null when unmatched / indices unavailable. */
  start: number | null;
  /** UTF-16 end offset (exclusive), or null. */
  end: number | null;
  /** Display position of the start, or null. */
  startPos: LineCol | null;
  /** Display position of the end, or null. */
  endPos: LineCol | null;
}

export interface MatchRecord {
  /** 1-based ordinal among all matches. */
  ordinal: number;
  /** UTF-16 start offset of the full match. */
  start: number;
  /** UTF-16 end offset (exclusive) of the full match. */
  end: number;
  /** UTF-16 length of the full match. */
  length: number;
  /** The full matched text (group 0). */
  value: string;
  /** True when the match is zero-width (length 0). */
  empty: boolean;
  startPos: LineCol;
  endPos: LineCol;
  /** All numbered capture groups, 1..n. */
  groups: GroupCapture[];
  /** The subset of groups that are named (convenience view; same objects as `groups`). */
  namedGroups: GroupCapture[];
}

export interface MatchResult {
  /** `ok` — completed; `timeout` — execution was stopped by the safety budget. */
  status: 'ok' | 'timeout';
  matches: MatchRecord[];
  /** Whether `g` or `y` was in effect (multiple matches possible). */
  global: boolean;
  /** True when more matches existed than the display cap allowed. */
  truncated: boolean;
  /** The cap that was applied (for messaging). */
  cap: number;
}

// ── Explanation ──────────────────────────────────────────────────────────────

export type ExplainKind =
  | 'alternation'
  | 'alternative'
  | 'group'
  | 'capture'
  | 'named-capture'
  | 'lookaround'
  | 'quantifier'
  | 'literal'
  | 'char-class'
  | 'char-set'
  | 'assertion'
  | 'backreference'
  | 'class-range'
  | 'class-op'
  | 'unsupported';

/** One node in the deterministic, nesting-preserving explanation tree. */
export interface ExplainNode {
  /** Stable id (a source-position path), for React keys and source highlighting. */
  id: string;
  kind: ExplainKind;
  /** The exact source fragment this node covers, e.g. `\d{4}`. */
  source: string;
  /** UTF-16 offset of the fragment within the pattern body. */
  start: number;
  end: number;
  /** A short, human title, e.g. "Exactly 4 of". */
  title: string;
  /** An optional secondary clause. */
  detail?: string;
  children?: ExplainNode[];
}

export interface Explanation {
  status: 'ok' | 'unavailable';
  nodes: ExplainNode[];
  /** Present when `status === 'unavailable'`. */
  message?: string;
}

// ── Diagnostics ──────────────────────────────────────────────────────────────

export type DiagnosticSeverity = 'warning' | 'notice' | 'info';

export interface Diagnostic {
  id: string;
  severity: DiagnosticSeverity;
  title: string;
  detail: string;
  /** Why it matters — the "so what". */
  why?: string;
}

export const DIAGNOSTIC_RANK: Record<DiagnosticSeverity, number> = {
  warning: 2,
  notice: 1,
  info: 0,
};

// ── Replacement ──────────────────────────────────────────────────────────────

export interface ReplacementResult {
  output: string;
  changed: boolean;
  /** Number of replacements performed (1 when non-global and a match exists). */
  count: number;
  global: boolean;
}

export type ReplacementTokenKind =
  | 'text'
  | 'match'
  | 'group'
  | 'named'
  | 'prefix'
  | 'suffix'
  | 'literal-dollar'
  | 'unknown-group'
  | 'unknown-named';

/** A parsed piece of a replacement string, for the compact token explanation. */
export interface ReplacementToken {
  raw: string;
  kind: ReplacementTokenKind;
  detail: string;
}

// ── Export ───────────────────────────────────────────────────────────────────

export interface ExportForms {
  /** A JavaScript regex literal, `/body/flags`, with literal `/` correctly escaped. */
  literal: string;
  /** A `new RegExp("…", "…")` constructor call with correct string escaping. */
  constructor: string;
}

// ── Test-case bench ──────────────────────────────────────────────────────────

export type TestExpectation = 'match' | 'no-match';

export interface TestCase {
  id: string;
  text: string;
  expected: TestExpectation;
}

export interface TestCaseResult {
  id: string;
  /** Whether the current pattern matched the row's text. */
  matched: boolean;
  /** Whether the observed result meets the expectation. */
  pass: boolean;
}
