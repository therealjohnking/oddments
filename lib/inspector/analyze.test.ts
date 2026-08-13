import { describe, expect, it } from 'vitest';
import { analyzeText } from './analyze';

const cp = (n: number) => String.fromCodePoint(n);
const NBSP = cp(0x00a0);
const ZWSP = cp(0x200b);
const RLO = cp(0x202e);
const CURLY_APOS = cp(0x2019);

describe('analyzeText — empty and plain input', () => {
  it('reports an empty analysis for empty input', () => {
    const a = analyzeText('');
    expect(a.isEmpty).toBe(true);
    expect(a.findings).toHaveLength(0);
    expect(a.headlineCount).toBe(0);
    expect(a.stats.codePoints).toBe(0);
  });

  it('finds nothing notable in plain ASCII', () => {
    const a = analyzeText('hello world');
    expect(a.isEmpty).toBe(false);
    expect(a.findings).toHaveLength(0);
    expect(a.headlineCount).toBe(0);
    expect(a.stats.codePoints).toBe(11);
    expect(a.stats.words).toBe(2);
    expect(a.stats.asciiSpaces).toBe(1);
    expect(a.stats.lines).toBe(1);
  });
});

describe('analyzeText — findings and positions', () => {
  it('locates a no-break space with 1-based line/column', () => {
    const a = analyzeText(`a${NBSP}b`);
    expect(a.findings).toHaveLength(1);
    const f = a.findings[0]!;
    expect(f.category).toBe('unusual-space');
    expect(f.line).toBe(1);
    expect(f.column).toBe(2);
    expect(f.offset).toBe(1);
    expect(a.headlineCount).toBe(1);
  });

  it('computes columns in code points across an astral character', () => {
    // A 2-UTF-16-unit emoji, then a zero-width space.
    const a = analyzeText(`${cp(0x1f600)}${ZWSP}`);
    expect(a.findings).toHaveLength(1);
    const f = a.findings[0]!;
    expect(f.column).toBe(2); // second code point
    expect(f.offset).toBe(2); // second code point starts at UTF-16 index 2
  });

  it('reveals tabs but does not count them toward the headline', () => {
    const a = analyzeText('a\tb');
    expect(a.stats.tabs).toBe(1);
    expect(a.findings.map((f) => f.category)).toEqual(['tab']);
    expect(a.headlineCount).toBe(0);
  });

  it('treats a leading U+FEFF as a byte-order mark', () => {
    const a = analyzeText(`${cp(0xfeff)}abc`);
    expect(a.bom).toBe(true);
    expect(a.findings[0]!.category).toBe('bom');
    expect(a.headlineCount).toBe(1);
  });

  it('sorts category summaries most-severe first', () => {
    const a = analyzeText(`${RLO}x${CURLY_APOS}`);
    expect(a.categorySummaries[0]!.category).toBe('bidi'); // danger
    expect(a.categorySummaries.map((s) => s.category)).toContain('confusable-quote');
  });
});

describe('analyzeText — lines and line endings', () => {
  it('detects mixed line endings', () => {
    const a = analyzeText('a\r\nb\nc\rd');
    expect(a.lineEndings).toMatchObject({ crlf: 1, lf: 1, cr: 1, total: 3, mixed: true });
    expect(a.stats.lines).toBe(4);
    expect(a.lines.map((l) => l.terminator)).toEqual(['crlf', 'lf', 'cr', 'none']);
  });

  it('reports a trailing empty line when text ends with a newline', () => {
    const a = analyzeText('a\n');
    expect(a.stats.lines).toBe(2);
    expect(a.lines[1]!.text).toBe('');
  });

  it('locates trailing whitespace runs', () => {
    const a = analyzeText('a   \nb');
    expect(a.trailingWhitespace).toHaveLength(1);
    expect(a.trailingWhitespace[0]).toMatchObject({ line: 1, column: 2, offset: 1, length: 3 });
  });

  it('does not flag leading indentation as trailing whitespace', () => {
    const a = analyzeText('    code');
    expect(a.trailingWhitespace).toHaveLength(0);
  });
});

describe('analyzeText — large input caps', () => {
  it('keeps counts exact even when the findings array is capped', () => {
    const input = ZWSP.repeat(5);
    const a = analyzeText(input, { maxFindings: 2 });
    expect(a.findings).toHaveLength(2);
    expect(a.findingsCapped).toBe(true);
    const zw = a.categorySummaries.find((s) => s.category === 'zero-width');
    expect(zw?.count).toBe(5);
    expect(a.headlineCount).toBe(5);
  });
});
