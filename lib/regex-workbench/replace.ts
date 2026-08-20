/**
 * Replacement preview and a compact explanation of replacement tokens.
 *
 * The output is produced by the real thing — `String.prototype.replace` with a
 * *string* replacement — so `$&`, `$1`, `$<name>`, `` $` ``, `$'` and `$$` behave
 * exactly as JavaScript defines them, including the rule that flags decide scope:
 * without `g`, only the first match is replaced. We never reimplement the
 * substitution language, and a replacement string is only ever data — never code.
 *
 * The token explainer mirrors the spec's GetSubstitution just closely enough to
 * teach: a `$7` with only two groups is reported as inert (JavaScript leaves it
 * literal), so the preview is never mysterious.
 */

import type { ReplacementResult, ReplacementToken } from './types';

export interface ReplaceInput {
  source: string;
  /** The user's flags (scope of replacement is decided here — `g` or not). */
  flags: string;
  text: string;
  replacement: string;
  /** Matches already found by the executor, reused to report a count. */
  matchCount: number;
  /** Whether the match count was capped (so the true count may be higher). */
  truncated: boolean;
}

export function applyReplacement(input: ReplaceInput): ReplacementResult {
  const global = input.flags.includes('g');
  let output = input.text;
  try {
    const re = new RegExp(input.source, input.flags);
    output = input.text.replace(re, input.replacement);
  } catch {
    // Should not happen for a compiled pattern; leave the text unchanged.
    return { output: input.text, changed: false, count: 0, global };
  }
  const changed = output !== input.text;
  const count = global ? input.matchCount : Math.min(input.matchCount, 1);
  return { output, changed, count, global };
}

/**
 * Parse a replacement string into labelled tokens for the compact explanation.
 * `groupCount` and `groupNames` let out-of-range and unknown references be marked
 * as inert exactly where JavaScript would leave them literal.
 */
export function explainReplacement(
  replacement: string,
  groupCount: number,
  groupNames: string[],
): ReplacementToken[] {
  const tokens: ReplacementToken[] = [];
  const names = new Set(groupNames);
  let text = '';
  const flushText = () => {
    if (text) {
      tokens.push({ raw: text, kind: 'text', detail: 'Literal text' });
      text = '';
    }
  };

  let i = 0;
  const n = replacement.length;
  while (i < n) {
    if (replacement[i] !== '$' || i + 1 >= n) {
      text += replacement[i];
      i += 1;
      continue;
    }
    const next = replacement[i + 1]!;
    if (next === '$') {
      flushText();
      tokens.push({ raw: '$$', kind: 'literal-dollar', detail: 'A literal dollar sign' });
      i += 2;
    } else if (next === '&') {
      flushText();
      tokens.push({ raw: '$&', kind: 'match', detail: 'The entire match' });
      i += 2;
    } else if (next === '`') {
      flushText();
      tokens.push({ raw: '$`', kind: 'prefix', detail: 'The text before the match' });
      i += 2;
    } else if (next === "'") {
      flushText();
      tokens.push({ raw: "$'", kind: 'suffix', detail: 'The text after the match' });
      i += 2;
    } else if (next === '<' && names.size > 0) {
      // `$<name>` is only a named reference when the pattern actually has named
      // groups. With none, JavaScript leaves `$<…>` entirely literal — so this
      // branch is skipped and the `$` falls through to the literal-text path.
      const close = replacement.indexOf('>', i + 2);
      if (close === -1) {
        text += replacement[i];
        i += 1;
      } else {
        const name = replacement.slice(i + 2, close);
        flushText();
        if (names.has(name)) {
          tokens.push({ raw: `$<${name}>`, kind: 'named', detail: `Named group “${name}”` });
        } else {
          tokens.push({
            raw: `$<${name}>`,
            kind: 'unknown-named',
            detail: `No group named “${name}” — JavaScript inserts nothing`,
          });
        }
        i = close + 1;
      }
    } else if (next >= '0' && next <= '9') {
      // Prefer a two-digit reference when it names a real group, else one digit.
      const two = replacement.slice(i + 1, i + 3);
      const twoNum = /^\d\d$/.test(two) ? Number(two) : NaN;
      const oneNum = Number(next);
      let num = NaN;
      let raw = '';
      if (!Number.isNaN(twoNum) && twoNum >= 1 && twoNum <= groupCount) {
        num = twoNum;
        raw = `$${two}`;
      } else if (oneNum >= 1 && oneNum <= groupCount) {
        num = oneNum;
        raw = `$${next}`;
      }
      flushText();
      if (!Number.isNaN(num)) {
        tokens.push({ raw, kind: 'group', detail: `Capture group ${num}` });
        i += raw.length;
      } else {
        tokens.push({
          raw: `$${next}`,
          kind: 'unknown-group',
          detail: `No group ${next} — JavaScript leaves this literal`,
        });
        i += 2;
      }
    } else {
      text += replacement[i];
      i += 1;
    }
  }
  flushText();
  return tokens;
}
