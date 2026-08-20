/**
 * Compilation: pattern body + flags → a validated, executable regex description.
 *
 * The native `RegExp` constructor is the source of truth for *validity and
 * semantics* — if it accepts the pattern, that is exactly what will run. regexpp
 * supplies the *structure* (group count, names, nullability); when regexpp and
 * the native engine disagree at the bleeding edge of the grammar, the native
 * engine wins and the structural extras degrade rather than block matching.
 *
 * `execFlags` adds the `d` (indices) flag when the runtime supports it. `d` is
 * purely additive — it changes nothing about what matches — so we can recover
 * capture-group positions without altering the user's regex. The user's own
 * flags are what appear in the UI and in every exported form.
 */

import { parseAst, collectGroups, patternIsNullable } from './ast';
import { canonicalizeFlags, isFlagChar, isFlagSupported, SUPPORTED_FLAGS } from './flags';
import type { CompileResult, FlagId, LiteralParse } from './types';

/** Add `d` for execution when supported and not already requested. */
function withIndices(flags: string): string {
  if (!SUPPORTED_FLAGS.has('d') || flags.includes('d')) return flags;
  // Canonical order keeps `d` first.
  return canonicalizeFlags(flags + 'd');
}

/**
 * Turn a native `RegExp` error message into a single clean sentence. The native
 * form is `Invalid regular expression: /source/flags: <reason>`; we strip the
 * echoed pattern (which we already show) and keep the engine's own reason
 * verbatim — never inventing a more precise location than it gave us.
 */
function cleanMessage(raw: string, source: string, flags: string): string {
  let message = raw.replace(/^SyntaxError:\s*/, '');
  const echoed = `Invalid regular expression: /${source}/${flags}: `;
  if (message.startsWith(echoed)) {
    message = message.slice(echoed.length);
  } else {
    // Fallback: strip a generic "Invalid regular expression: …: " prefix.
    const generic = /^Invalid regular expression:.*?:\s*/;
    message = message.replace(generic, '');
  }
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/** A conservative, structural hint for a few common mistakes — never positional. */
function hintFor(message: string, flags: string): string | undefined {
  const lower = message.toLowerCase();
  if (flags.includes('u') && flags.includes('v')) {
    return 'The `u` and `v` flags are mutually exclusive — `v` is the newer superset. Use one or the other.';
  }
  if (lower.includes('invalid group')) {
    return 'Named groups use `(?<name>…)`; a plain group is `(…)` and a non-capturing group is `(?:…)`.';
  }
  if (lower.includes('duplicate capture group name')) {
    return 'Two groups share a name. Duplicate names are only allowed across separate alternation branches.';
  }
  if (lower.includes('nothing to repeat')) {
    return 'A quantifier (`*`, `+`, `?`, `{n}`) needs something before it to repeat.';
  }
  if (lower.includes('unterminated')) {
    return 'A group `(` or character class `[` was opened but never closed.';
  }
  if (lower.includes('invalid flags')) {
    return 'Check the flags: `u` and `v` cannot be combined, and each flag may appear once.';
  }
  return undefined;
}

export function compilePattern(sourceInput: string, flagsInput: string): CompileResult {
  const source = sourceInput;
  const flags = canonicalizeFlags(flagsInput);

  // Report unknown or unsupported flag letters ourselves — clearer than the
  // native "Invalid flags" for a letter that simply isn't a regex flag here.
  const bad: string[] = [];
  const seen = new Set<string>();
  for (const ch of flagsInput) {
    if (seen.has(ch)) continue;
    seen.add(ch);
    if (!isFlagChar(ch)) bad.push(`\`${ch}\` is not a JavaScript regex flag`);
    else if (!isFlagSupported(ch as FlagId)) bad.push(`\`${ch}\` is not supported by this runtime`);
  }
  if (bad.length > 0) {
    return {
      ok: false,
      source,
      flags,
      message: `Unsupported flag: ${bad.join('; ')}.`,
      hint: 'This workbench uses the JavaScript / ECMAScript `RegExp` engine; only its flags apply.',
    };
  }

  let regex: RegExp;
  try {
    // Validate with the user's own flags — the honest thing the user wrote, so an
    // error message never mentions the internally-added `d`.
    void new RegExp(source, flags);
    // Execute with indices when available, for capture-group positions.
    regex = new RegExp(source, withIndices(flags));
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const message = cleanMessage(raw, source, flags);
    return { ok: false, source, flags, message, hint: hintFor(message, flags) };
  }

  const parsed = parseAst(source, flags);
  let groupCount = 0;
  let groupNames: string[] = [];
  let groupNamesByNumber: (string | null)[] = [];
  let canMatchEmpty = false;
  if (parsed.ok) {
    const groups = collectGroups(parsed.ast);
    groupCount = groups.count;
    groupNames = groups.names;
    groupNamesByNumber = groups.ordered;
    canMatchEmpty = patternIsNullable(parsed.ast);
  } else {
    // regexpp could not parse a pattern the engine accepted (very new syntax).
    // Fall back to counting groups via the engine itself; names are then absent.
    groupCount = countGroupsViaEngine(source, flags);
    groupNamesByNumber = new Array(groupCount).fill(null);
  }

  return {
    ok: true,
    source,
    flags,
    execFlags: regex.flags,
    groupCount,
    groupNames,
    groupNamesByNumber,
    canMatchEmpty,
  };
}

/**
 * Count capturing groups using only the engine, for the rare case regexpp cannot
 * parse a pattern the engine accepts. Appending `|` makes the whole pattern also
 * match the empty string, so `.exec('')` succeeds and its result array length is
 * `groups + 1`. The throwaway regex is never executed against user text.
 */
function countGroupsViaEngine(source: string, flags: string): number {
  try {
    const probe = new RegExp(`${source}|`, flags.replace(/[gy]/g, ''));
    const result = probe.exec('');
    return result ? result.length - 1 : 0;
  } catch {
    return 0;
  }
}

/**
 * Parse a pasted JavaScript regex literal, `/body/flags`, as an explicit import
 * convenience. Returns `null` when the text is not unambiguously a literal, so
 * the ordinary body-only field never has to guess: a value only counts as a
 * literal when it starts with `/`, has a closing `/` that is not escaped, and any
 * trailing characters are valid flag letters. The body keeps its escapes exactly.
 */
export function parseLiteral(input: string): LiteralParse | null {
  const text = input.trim();
  if (text.length < 2 || text[0] !== '/') return null;

  // Find the closing slash: the last `/` not preceded by an unescaped backslash.
  let closing = -1;
  for (let i = 1; i < text.length; i++) {
    if (text[i] === '\\') {
      i += 1; // skip the escaped character
      continue;
    }
    if (text[i] === '/') closing = i;
  }
  if (closing <= 0) return null;

  const body = text.slice(1, closing);
  const flags = text.slice(closing + 1);
  if (body.length === 0) return null;
  for (const ch of flags) if (!isFlagChar(ch)) return null;

  return { body, flags: canonicalizeFlags(flags) };
}
