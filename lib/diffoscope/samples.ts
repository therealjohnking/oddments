/**
 * Built-in example pairs. Each showcases a different comparison mode.
 *
 * The "hidden differences" pair is built from named code-point constants rather
 * than raw literals, so the source stays fully reviewable — you can see exactly
 * which invisible or look-alike character sits where (a literal decomposed "é"
 * is indistinguishable from a precomposed one right here in the file). It packs,
 * into three short lines: a curly apostrophe, an em dash, a non-breaking space, a
 * decomposed (combining) accent, a zero-width space, trailing whitespace, and
 * CRLF-vs-LF line endings — while rendering identically to its plain twin.
 */

import type { DiffMode } from './types';

export interface DiffExample {
  id: string;
  label: string;
  description: string;
  /** The mode that best showcases this example. */
  mode: DiffMode;
  a: string;
  b: string;
}

const cp = (n: number): string => String.fromCodePoint(n);
const E_ACUTE = cp(0x00e9); //  precomposed "é"
const COMBINING_ACUTE = cp(0x0301); //  combining acute accent (decomposes "é")
const CURLY_APOS = cp(0x2019); //  right single quotation mark
const EM_DASH = cp(0x2014); //  em dash
const NBSP = cp(0x00a0); //  no-break space
const ZWSP = cp(0x200b); //  zero-width space

// ── Flagship: looks identical, isn't ────────────────────────────────────────
// A: straight punctuation, precomposed "é", ordinary spaces, LF line endings.
const HIDDEN_A =
  "The team's report is ready - 10 items done.\n" +
  `Caf${E_ACUTE} notes: all good.\n` +
  'Status: complete.';

// B renders identically to A but swaps in a curly apostrophe, an em dash, a
// non-breaking space, a decomposed "é" (e + combining acute), a zero-width space
// inside "good", a trailing space run on the final line, and CRLF line endings.
const HIDDEN_B =
  `The team${CURLY_APOS}s report is ready ${EM_DASH} 10${NBSP}items done.\r\n` +
  `Cafe${COMBINING_ACUTE} notes: all go${ZWSP}od.\r\n` +
  'Status: complete.  ';

// ── Ordinary prose revision ─────────────────────────────────────────────────
const PROSE_A =
  'Our new dashboard helps teams track projects in real time. ' + 'It is fast and simple to use.';

const PROSE_B =
  'Our redesigned dashboard helps teams track projects and budgets in real time. ' +
  'It is fast, simple, and genuinely pleasant to use.';

// ── Config / line-oriented ──────────────────────────────────────────────────
const CONFIG_A = 'name = diffoscope\n' + 'port = 8080\n' + 'debug = false\n' + 'retries = 3\n';

const CONFIG_B =
  'name = diffoscope\n' + 'port = 8080\n' + 'debug = true\n' + 'timeout = 30\n' + 'retries = 3\n';

export const EXAMPLES: DiffExample[] = [
  {
    id: 'hidden',
    label: 'Looks identical',
    description:
      'Two versions that look the same on screen but hide a curly apostrophe, an em dash, a non-breaking space, a combining accent, a zero-width space, trailing whitespace, and CRLF line endings.',
    mode: 'char',
    a: HIDDEN_A,
    b: HIDDEN_B,
  },
  {
    id: 'prose',
    label: 'Prose revision',
    description:
      'An ordinary before/after edit of a paragraph — words inserted, replaced, and dropped.',
    mode: 'word',
    a: PROSE_A,
    b: PROSE_B,
  },
  {
    id: 'config',
    label: 'Config change',
    description:
      'A small configuration file with a changed value and an added line — the natural home for line mode and the unified diff.',
    mode: 'line',
    a: CONFIG_A,
    b: CONFIG_B,
  },
];

/** The example loaded by the primary "Load example" action. */
export const FLAGSHIP_EXAMPLE = EXAMPLES[0]!;
