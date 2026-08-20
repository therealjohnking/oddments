/**
 * Built-in examples — a compact set that shows *why* the workbench exists rather
 * than a wall of instructional text. Each loads a pattern, flags, sample text and
 * (where relevant) a replacement, and then flows through the ordinary pipeline
 * with no special-casing. They lean on JavaScript-specific behaviour: named
 * groups, a zero-width lookbehind, per-line anchors, Unicode properties, named
 * back-substitution, and — deliberately — a pattern that trips the safety timeout.
 */

export interface RegexExample {
  id: string;
  label: string;
  blurb: string;
  pattern: string;
  flags: string;
  text: string;
  /** Loaded into the replacement field when present. */
  replacement?: string;
}

export const EXAMPLES: RegexExample[] = [
  {
    id: 'named-groups',
    label: 'Named groups',
    blurb: 'Phone numbers split into named area / prefix / line groups.',
    pattern: '(?<area>\\d{3})[-.\\s](?<prefix>\\d{3})[-.\\s](?<line>\\d{4})',
    flags: 'g',
    text: 'Call 415-555-0132 or 202.555.0175, fax 312 555 0148.',
  },
  {
    id: 'lookbehind',
    label: 'Lookaround',
    blurb: 'A zero-width lookbehind grabs the number after each “$”, without eating it.',
    pattern: '(?<=\\$)\\d+(?:\\.\\d{2})?',
    flags: 'g',
    text: 'Subtotal $19.99, tax $1.50, shipping $0, total $21.49.',
  },
  {
    id: 'multiline',
    label: 'Multiline anchors',
    blurb: 'With m, ^ and $ match each line — here, the first word of every line.',
    pattern: '^(\\w+)',
    flags: 'gm',
    text: 'alpha one\nbravo two\ncharlie three',
  },
  {
    id: 'unicode',
    label: 'Unicode property',
    blurb: 'With u, \\p{L}+ matches runs of letters in any script, astral ones included.',
    pattern: '\\p{L}+',
    flags: 'gu',
    text: 'Grüße, Ωμέγα, 日本語, and 𝔘nicode!',
  },
  {
    id: 'replace-reorder',
    label: 'Replacement',
    blurb: 'Reorder “First Last” into “Last, First” with named back-substitution.',
    pattern: '(?<first>\\w+) (?<last>\\w+)',
    flags: 'gm',
    text: 'Ada Lovelace\nGrace Hopper\nAlan Turing',
    replacement: '$<last>, $<first>',
  },
  {
    id: 'zero-width',
    label: 'Zero-width',
    blurb: 'A word boundary matches between characters — every match is empty.',
    pattern: '\\b',
    flags: 'g',
    text: 'two words',
  },
  {
    id: 'catastrophic',
    label: 'Backtracking trap',
    blurb: 'Nested quantifiers on non-matching text — watch the run get stopped by the timeout.',
    pattern: '(a+)+$',
    flags: '',
    text: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!',
  },
];
