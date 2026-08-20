/**
 * Diagnostics — a restrained set of findings for genuinely surprising behaviour.
 *
 * Ground rules, taken seriously:
 *   • We never claim a pattern is "vulnerable" or "safe". Backtracking cost is
 *     input-dependent and not decidable from structure alone; the worker timeout
 *     is the real safety net. What we *can* do is point at a clear structural
 *     shape and say "this can backtrack expensively on some inputs".
 *   • A lone `.*`, an unanchored pattern, or an ordinary quantifier is not a
 *     problem and is never flagged.
 *
 * Everything here is derived from the AST (or from compile facts), so a finding
 * always has a concrete, explainable basis.
 */

import { parseAst, type AST } from './ast';
import { DIAGNOSTIC_RANK, type Diagnostic } from './types';

export interface DiagnosticInput {
  source: string;
  flags: string;
  /** Whether the pattern can match the empty string (from compilation). */
  canMatchEmpty: boolean;
}

export function computeDiagnostics(input: DiagnosticInput): Diagnostic[] {
  const { source, flags, canMatchEmpty } = input;
  const diagnostics: Diagnostic[] = [];
  const global = flags.includes('g') || flags.includes('y');

  if (canMatchEmpty) {
    if (global) {
      diagnostics.push({
        id: 'global-zero-width',
        severity: 'notice',
        title: 'Global pattern can match empty',
        detail:
          'With g or y set, a pattern that can match the empty string produces zero-width matches between characters. Iteration only makes progress because the engine (and this tool) advances one position past each empty match.',
        why: 'This is a classic source of “too many matches” and of replacements that insert text at every position.',
      });
    } else {
      diagnostics.push({
        id: 'can-match-empty',
        severity: 'info',
        title: 'Pattern can match empty text',
        detail:
          'This pattern can succeed while consuming no characters — for example at a position where every part is optional. Add anchors or required characters if that is not intended.',
        why: 'Empty matches change how replacement and repeated matching behave, often surprisingly.',
      });
    }
  }

  const parsed = parseAst(source, flags);
  if (parsed.ok) {
    const nested = findNestedQuantifier(parsed.ast);
    if (nested) {
      diagnostics.push({
        id: 'nested-quantifier',
        severity: 'warning',
        title: 'Potential backtracking risk',
        detail: `A repeating quantifier contains another variable quantifier (near \`${nested}\`). On some inputs the engine can try an enormous number of ways to split the text.`,
        why: 'Nested unbounded repetition is the structural shape behind catastrophic backtracking. This is a heuristic, not a proof — the workbench also stops any run that takes too long.',
      });
    }
  }

  return diagnostics.sort((a, b) => DIAGNOSTIC_RANK[b.severity] - DIAGNOSTIC_RANK[a.severity]);
}

/**
 * Find an unbounded quantifier (`*`, `+`, `{n,}`) whose body contains another
 * quantifier that is itself variable-length (`max` is Infinity, or `min` is 0).
 * That nesting — `(a+)+`, `(.*)*`, `(\w*)+`, `(?:a?)*` — is the classic
 * catastrophic-backtracking shape. A fixed-count inner quantifier (`(?:a{2})+`)
 * is not flagged, and neither is a single quantifier. Returns the outer raw
 * source of the first hit, or null.
 */
function findNestedQuantifier(ast: AST.Pattern): string | null {
  let hit: string | null = null;

  const walkAlts = (alts: AST.Alternative[]): void => {
    for (const alt of alts) for (const el of alt.elements) walkEl(el);
  };

  const walkEl = (el: AST.Element): void => {
    if (hit) return;
    if (el.type === 'Quantifier') {
      if (el.max === Infinity && containsVariableQuantifier(el.element)) {
        hit = el.raw;
        return;
      }
      walkEl(el.element);
    } else if (el.type === 'CapturingGroup' || el.type === 'Group') {
      walkAlts(el.alternatives);
    } else if (el.type === 'Assertion' && (el.kind === 'lookahead' || el.kind === 'lookbehind')) {
      walkAlts(el.alternatives);
    }
  };

  walkAlts(ast.alternatives);
  return hit;
}

/** Does this element's subtree contain a variable-length quantifier? */
function containsVariableQuantifier(el: AST.Element): boolean {
  let found = false;
  const visitAlts = (alts: AST.Alternative[]): void => {
    for (const alt of alts) for (const child of alt.elements) visit(child);
  };
  const visit = (node: AST.Element): void => {
    if (found) return;
    if (node.type === 'Quantifier') {
      if (node.max === Infinity || node.min === 0) {
        found = true;
        return;
      }
      visit(node.element);
    } else if (node.type === 'CapturingGroup' || node.type === 'Group') {
      visitAlts(node.alternatives);
    } else if (
      node.type === 'Assertion' &&
      (node.kind === 'lookahead' || node.kind === 'lookbehind')
    ) {
      visitAlts(node.alternatives);
    }
  };
  visit(el);
  return found;
}
