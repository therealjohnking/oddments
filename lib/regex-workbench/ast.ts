/**
 * The single seam onto `@eslint-community/regexpp` — the mature ECMAScript regex
 * AST parser that also backs ESLint's regexp rules. It is wrapped here so the
 * rest of the engine (and certainly React) never imports the third-party parser
 * directly: `explain` and `diagnostics` consume this module's helpers, and only
 * plain domain data leaves `lib/regex-workbench`.
 *
 * regexpp is a *linear* parser — it builds a tree, it does not execute the
 * pattern — so parsing here is safe against catastrophic backtracking. The
 * dangerous part (running the compiled regex over user text) is the worker's job.
 *
 * The parser targets the latest ECMAScript grammar it knows, so modern syntax —
 * named groups, lookbehind, `\p{…}` properties, `v`-mode set operations, inline
 * `(?i:…)` modifiers — is understood. When it cannot parse something the native
 * engine accepts, callers degrade gracefully rather than guess.
 */

import { RegExpParser } from '@eslint-community/regexpp';
import type { AST } from '@eslint-community/regexpp';

export type { AST };
export type RegexPattern = AST.Pattern;

const parser = new RegExpParser();

export type ParseOutcome =
  { ok: true; ast: AST.Pattern } | { ok: false; message: string; index?: number };

/**
 * Parse a pattern body into an AST. `u`/`v` change the *syntax* accepted, so the
 * relevant flags are passed through; the other flags do not affect parsing.
 */
export function parseAst(source: string, flags: string): ParseOutcome {
  try {
    const ast = parser.parsePattern(source, 0, source.length, {
      unicode: flags.includes('u'),
      unicodeSets: flags.includes('v'),
    });
    return { ok: true, ast };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const index =
      error && typeof error === 'object' && 'index' in error && typeof error.index === 'number'
        ? error.index
        : undefined;
    return { ok: false, message, index };
  }
}

export interface GroupInfo {
  count: number;
  /** Named-group names only, in source order. */
  names: string[];
  /** One entry per capturing group in numbering order: its name, or null. */
  ordered: (string | null)[];
}

/** Count capturing groups (in numbering order) and collect named-group names. */
export function collectGroups(ast: AST.Pattern): GroupInfo {
  const names: string[] = [];
  const ordered: (string | null)[] = [];
  let count = 0;
  const walkAlternatives = (alternatives: AST.Alternative[]): void => {
    for (const alt of alternatives) for (const el of alt.elements) walkElement(el);
  };
  const walkElement = (el: AST.Element): void => {
    switch (el.type) {
      case 'CapturingGroup':
        count += 1;
        ordered.push(el.name ?? null);
        if (el.name) names.push(el.name);
        walkAlternatives(el.alternatives);
        break;
      case 'Group':
        walkAlternatives(el.alternatives);
        break;
      case 'Quantifier':
        walkElement(el.element);
        break;
      case 'Assertion':
        if (el.kind === 'lookahead' || el.kind === 'lookbehind') walkAlternatives(el.alternatives);
        break;
      default:
        break;
    }
  };
  walkAlternatives(ast.alternatives);
  return { count, names, ordered };
}

/**
 * Structural nullability: can the pattern match consuming **zero characters**?
 * This is exactly the property that produces surprising zero-width matches under
 * `g`/`y`. Anchors, word boundaries and lookarounds are zero-width and therefore
 * nullable; a bare character, `\d`, `.` or a character class always consumes at
 * least one unit and is not. A quantifier is nullable when its minimum is 0 or
 * its body is nullable; a group when any alternative is nullable.
 *
 * A backreference is treated as nullable because it matches the empty string when
 * its group captured nothing — a genuine (if uncommon) way to match empty.
 */
export function patternIsNullable(ast: AST.Pattern): boolean {
  return alternativesNullable(ast.alternatives);
}

function alternativesNullable(alternatives: AST.Alternative[]): boolean {
  return alternatives.some((alt) => alt.elements.every(elementNullable));
}

function elementNullable(el: AST.Element): boolean {
  switch (el.type) {
    case 'Assertion':
      return true;
    case 'Backreference':
      return true;
    case 'Quantifier':
      return el.min === 0 || elementNullable(el.element);
    case 'Group':
    case 'CapturingGroup':
      return alternativesNullable(el.alternatives);
    case 'Character':
    case 'CharacterSet':
    case 'CharacterClass':
    case 'ExpressionCharacterClass':
      return false;
    default:
      return false;
  }
}
