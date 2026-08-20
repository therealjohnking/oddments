/**
 * Public API for the Regex Workbench engine — a local-first instrument for the
 * **JavaScript / ECMAScript `RegExp`** engine, and only that engine.
 *
 * The pipeline is inspectable and side-effect-free:
 *   1. compile   — pattern body + flags → validated, executable description
 *   2. execute   — run the regex over text (off the main thread) → raw matches
 *   3. enrich    — raw matches → positions, groups, zero-width flags
 *   4. explain   — the AST → a deterministic, nesting-preserving explanation
 *   5. diagnose  — the AST → restrained, structural hazard findings
 *   6. replace   — actual JS replacement semantics + a token explanation
 *
 * Only plain, serialisable data crosses this boundary — no `RegExp`, no
 * third-party AST node, no React. That is what lets `execute` run inside a Worker
 * and lets every rule be unit-tested without a DOM.
 */

export { compilePattern, parseLiteral } from './compile';
export {
  FLAG_ORDER,
  SUPPORTED_FLAGS,
  canonicalizeFlags,
  flagList,
  isFlagChar,
  isFlagSupported,
  toggleFlag,
} from './flags';
export { executeRegex } from './execute';
export type { ExecInput, ExecResult, RawGroup, RawMatch } from './execute';
export { enrichMatches, emptyMatchResult } from './matches';
export { explainPattern } from './explain';
export { computeDiagnostics } from './diagnostics';
export { applyReplacement, explainReplacement } from './replace';
export { exportForms, toRegexLiteral, toConstructor, escapeForLiteral } from './export';
export { toDiagnosticSummary } from './report';
export { EXAMPLES } from './examples';
export type { RegexExample } from './examples';
export { LineIndex } from './positions';
export type { LineCol } from './positions';
export {
  MAX_TEST_CASES,
  MAX_TEST_CASE_LENGTH,
  evaluateTestCases,
  patternMatches,
} from './testcases';
export { MATCH_CAP, WORKER_TIMEOUT_MS, LARGE_TEXT_WARN, HIGHLIGHT_TEXT_CAP } from './limits';
export {
  STORAGE_KEY,
  STORAGE_VERSION,
  defaultSettings,
  deserializeSettings,
  serializeSettings,
  loadSettings,
  saveSettings,
} from './persistence';
export type { Settings } from './persistence';

export { DIAGNOSTIC_RANK } from './types';
export type {
  CompileOk,
  CompileError,
  CompileResult,
  Diagnostic,
  DiagnosticSeverity,
  ExplainKind,
  ExplainNode,
  Explanation,
  ExportForms,
  FlagId,
  FlagMeta,
  GroupCapture,
  LiteralParse,
  MatchRecord,
  MatchResult,
  ReplacementResult,
  ReplacementToken,
  ReplacementTokenKind,
  TestCase,
  TestCaseResult,
  TestExpectation,
} from './types';
