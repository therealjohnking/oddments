/**
 * Output representations of a pattern: a JavaScript regex literal and a
 * `new RegExp(...)` constructor call. Both are exact and paste-ready; neither
 * alters the pattern the user typed.
 *
 * The literal form escapes unescaped forward slashes (so `foo/bar` becomes
 * `/foo\/bar/` while an already-escaped `\/` is left alone) **and line
 * terminators** (LF, CR, U+2028, U+2029) — a raw line terminator is disallowed
 * inside a regex literal, so leaving it raw would produce an *invalid* literal
 * even for a pattern that compiles (U+2028/U+2029 in particular pass straight
 * through a text input). This mirrors what `RegExp.prototype.source` renders. An
 * empty body becomes the canonical `(?:)`, because `//` is a comment, not a
 * regex. The constructor form leans on `JSON.stringify`, which produces a
 * correctly escaped double-quoted JavaScript string for the source and flags.
 */

import type { ExportForms } from './types';

/**
 * The escape for a raw line terminator, or null if the character is not one.
 * Matched by code point so no invisible U+2028/U+2029 appears in this source.
 */
function lineTerminatorEscape(ch: string): string | null {
  switch (ch.charCodeAt(0)) {
    case 0x0a:
      return '\\n';
    case 0x0d:
      return '\\r';
    case 0x2028:
      return '\\u2028';
    case 0x2029:
      return '\\u2029';
    default:
      return null;
  }
}

/** Escape unescaped `/` and any raw line terminator for use inside a `/…/` literal. */
export function escapeForLiteral(source: string): string {
  if (source === '') return '(?:)';
  let out = '';
  let i = 0;
  const n = source.length;
  while (i < n) {
    const ch = source[i]!;
    if (ch === '\\') {
      const next = i + 1 < n ? source[i + 1]! : '';
      const escaped = next === '' ? null : lineTerminatorEscape(next);
      if (escaped !== null) {
        // `\` + a raw line terminator is an escaped terminator; JS renders it as
        // the mnemonic (e.g. `\n`), the backslash absorbed into the escape.
        out += escaped;
      } else {
        // Preserve the escape sequence verbatim (including an already-escaped `/`).
        out += ch;
        if (next !== '') out += next;
      }
      i += 2;
      continue;
    }
    if (ch === '/') {
      out += '\\/';
      i += 1;
      continue;
    }
    out += lineTerminatorEscape(ch) ?? ch;
    i += 1;
  }
  return out;
}

export function toRegexLiteral(source: string, flags: string): string {
  return `/${escapeForLiteral(source)}/${flags}`;
}

export function toConstructor(source: string, flags: string): string {
  const src = JSON.stringify(source);
  return flags ? `new RegExp(${src}, ${JSON.stringify(flags)})` : `new RegExp(${src})`;
}

export function exportForms(source: string, flags: string): ExportForms {
  return {
    literal: toRegexLiteral(source, flags),
    constructor: toConstructor(source, flags),
  };
}
