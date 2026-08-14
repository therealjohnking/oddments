import { describe, expect, it } from 'vitest';
import { analyzePair } from './index';
import { computeVerdict, extractSubtleFindings } from './diagnostics';
import type { SubtleKind } from './types';

const cp = (n: number) => String.fromCodePoint(n);
const NBSP = cp(0x00a0);
const ZWSP = cp(0x200b);
const BOM = cp(0xfeff);
const CURLY_APOS = cp(0x2019);
const EM_DASH = cp(0x2014);
const EN_DASH = cp(0x2013);
const ELLIPSIS = cp(0x2026);
const CYRILLIC_A = cp(0x0430); // looks like Latin 'a'
const COMBINING_ACUTE = cp(0x0301);
const hasSegmenter = typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter === 'function';

function kinds(a: string, b: string): SubtleKind[] {
  return analyzePair(a, b).findings.map((f) => f.kind);
}

describe('computeVerdict', () => {
  it('identical', () => {
    expect(computeVerdict('same', 'same').kind).toBe('identical');
  });

  it('empty vs non-empty', () => {
    expect(computeVerdict('', 'x').kind).toBe('empty-vs-nonempty');
  });

  it('line endings only', () => {
    expect(computeVerdict('a\r\nb\r\nc', 'a\nb\nc').kind).toBe('line-endings');
  });

  it('whitespace only (spaces and NBSP)', () => {
    expect(computeVerdict('a  b', 'a b').kind).toBe('whitespace');
    expect(computeVerdict(`a${NBSP}b`, 'a b').kind).toBe('whitespace');
  });

  it('case only', () => {
    expect(computeVerdict('Hello World', 'hello world').kind).toBe('case');
  });

  it('NFC equivalence', () => {
    expect(computeVerdict(`Caf${cp(0x00e9)}`, `Cafe${COMBINING_ACUTE}`).kind).toBe('nfc');
  });

  it('punctuation only (curly quote, dash, ellipsis)', () => {
    expect(computeVerdict("it's", `it${CURLY_APOS}s`).kind).toBe('punctuation');
    expect(computeVerdict('a-b', `a${EM_DASH}b`).kind).toBe('punctuation');
    expect(computeVerdict('a...b', `a${ELLIPSIS}b`).kind).toBe('punctuation');
  });

  it('invisible characters only', () => {
    expect(computeVerdict('ab', `a${ZWSP}b`).kind).toBe('invisibles');
    expect(computeVerdict('abc', `${BOM}abc`).kind).toBe('invisibles');
  });

  it('cosmetic combination reports the contributing dimensions', () => {
    const verdict = computeVerdict('Hello  World', 'hello world');
    expect(verdict.kind).toBe('cosmetic');
    expect(verdict.dimensions).toContain('case');
    expect(verdict.dimensions).toContain('whitespace');
  });

  it('genuinely different content', () => {
    expect(computeVerdict('cat', 'dog').kind).toBe('different');
  });
});

describe('subtle findings', () => {
  it('space vs non-breaking space', () => {
    const findings = analyzePair('a b', `a${NBSP}b`).findings;
    const ws = findings.find((f) => f.kind === 'whitespace');
    expect(ws).toBeDefined();
    expect(ws!.count).toBe(1);
    // Position is reported on both sides.
    expect(ws!.examples[0]!.aColumn).toBe(2);
    expect(ws!.examples[0]!.bColumn).toBe(2);
  });

  it('tab vs space', () => {
    expect(kinds('a\tb', 'a b')).toContain('whitespace');
  });

  it('trailing whitespace on one side', () => {
    const findings = analyzePair('hello', 'hello  ').findings;
    expect(findings.some((f) => f.kind === 'whitespace')).toBe(true);
  });

  it('zero-width space present on one side', () => {
    const findings = analyzePair('ab', `a${ZWSP}b`).findings;
    const inv = findings.find((f) => f.kind === 'invisible');
    expect(inv).toBeDefined();
    expect(inv!.severity).toBe('warning');
  });

  it('byte-order mark present on one side', () => {
    expect(kinds('abc', `${BOM}abc`)).toContain('invisible');
  });

  it('curly vs straight apostrophe', () => {
    expect(kinds("it's", `it${CURLY_APOS}s`)).toContain('punctuation');
  });

  it('hyphen vs en dash vs em dash', () => {
    expect(kinds('a-b', `a${EN_DASH}b`)).toContain('punctuation');
    expect(kinds('a-b', `a${EM_DASH}b`)).toContain('punctuation');
  });

  it('ellipsis character vs three periods', () => {
    expect(kinds('a...b', `a${ELLIPSIS}b`)).toContain('punctuation');
  });

  it('homoglyph letter', () => {
    const findings = analyzePair('paypal', `p${CYRILLIC_A}ypal`).findings;
    const homo = findings.find((f) => f.kind === 'homoglyph');
    expect(homo).toBeDefined();
    expect(homo!.severity).toBe('warning');
  });

  it('line-ending style difference is its own finding', () => {
    const findings = analyzePair('a\r\nb', 'a\nb').findings;
    const le = findings.find((f) => f.kind === 'line-ending');
    expect(le).toBeDefined();
    expect(le!.detail).toMatch(/CRLF/);
    expect(le!.detail).toMatch(/LF/);
  });

  it('NFC-equivalent representation (when grapheme segmentation is available)', () => {
    const findings = analyzePair(`Caf${cp(0x00e9)}`, `Cafe${COMBINING_ACUTE}`).findings;
    if (hasSegmenter) {
      expect(findings.some((f) => f.kind === 'normalization')).toBe(true);
    }
  });

  it('suppresses noise for genuinely different text', () => {
    expect(analyzePair('The cat sat.', 'A dog ran fast today.').findings).toHaveLength(0);
  });

  it('skips the per-character scan for very large inputs', () => {
    const big = 'x'.repeat(50_000);
    const result = extractSubtleFindings(big, big + 'y', 'different');
    expect(result.skipped).toBe(true);
  });
});

describe('regressions from the adversarial review', () => {
  const CYRILLIC_IE = cp(0x0435); // looks like 'e'
  const LDQUO = cp(0x201c);
  const RDQUO = cp(0x201d);

  it('does not claim a line-ending style difference when only the line count changed (same style)', () => {
    // Blank line added — both sides are pure LF.
    expect(analyzePair('a\nb', 'a\n\nb').findings.some((f) => f.kind === 'line-ending')).toBe(
      false,
    );
    // Trailing-newline change — both sides are pure LF.
    expect(analyzePair('a\nb\n', 'a\nb').findings.some((f) => f.kind === 'line-ending')).toBe(
      false,
    );
    // A genuine style change is still reported.
    expect(analyzePair('a\r\nb', 'a\nb').findings.some((f) => f.kind === 'line-ending')).toBe(true);
  });

  it('locates adjacent homoglyphs (a contiguous 2-grapheme run)', () => {
    const findings = analyzePair(`${CYRILLIC_A}${CYRILLIC_IE}`, 'ae').findings;
    const homo = findings.filter((f) => f.kind === 'homoglyph');
    expect(homo.length).toBeGreaterThanOrEqual(1);
    expect(homo.reduce((sum, f) => sum + f.count, 0)).toBe(2);
  });

  it('locates an adjacent curly-quote pair and a multi-char tab-vs-spaces indent', () => {
    expect(
      analyzePair(`${LDQUO}x${RDQUO}`, '"x"').findings.some((f) => f.kind === 'punctuation'),
    ).toBe(true);
    expect(analyzePair('\t\tx', '  x').findings.some((f) => f.kind === 'whitespace')).toBe(true);
  });

  it('labels a homoglyph-only difference as a homoglyph verdict, not punctuation', () => {
    expect(computeVerdict('hello', `h${CYRILLIC_IE}llo`).kind).toBe('homoglyph');
    // Genuine punctuation-only differences are still "punctuation".
    expect(computeVerdict("it's", `it${CURLY_APOS}s`).kind).toBe('punctuation');
  });

  it('keeps the invisible-characters dimension when a BOM coexists with case', () => {
    const verdict = computeVerdict(`${BOM}HELLO`, 'hello');
    expect(verdict.kind).toBe('cosmetic');
    expect(verdict.dimensions).toContain('invisibles');
    expect(verdict.dimensions).toContain('case');
  });
});
