import { describe, expect, it } from 'vitest';
import { toUnifiedDiff } from './unified-diff';
import { EXACT_LENS, type LensState } from './types';

const lens = (over: Partial<LensState>): LensState => ({ ...EXACT_LENS, ...over });

describe('toUnifiedDiff', () => {
  it('returns an empty string when there are no line differences', () => {
    expect(toUnifiedDiff('a\nb\n', 'a\nb\n')).toBe('');
  });

  it('emits headers and a hunk for a changed line', () => {
    const patch = toUnifiedDiff('a\nold\nc\n', 'a\nnew\nc\n');
    expect(patch).toContain('--- A');
    expect(patch).toContain('+++ B');
    expect(patch).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(patch).toContain('-old');
    expect(patch).toContain('+new');
    expect(patch).toContain(' a');
    expect(patch).toContain(' c');
  });

  it('marks an added line', () => {
    const patch = toUnifiedDiff('a\nb\n', 'a\nx\nb\n');
    expect(patch).toContain('+x');
    // The hunk header widths reflect one extra line on the B side.
    expect(patch).toMatch(/@@ -1,\d+ \+1,\d+ @@/);
  });

  it('marks a deleted line', () => {
    const patch = toUnifiedDiff('a\nx\nb\n', 'a\nb\n');
    expect(patch).toContain('-x');
  });

  it('notes a missing final newline', () => {
    const patch = toUnifiedDiff('a\nb', 'a\nc');
    expect(patch).toContain('\\ No newline at end of file');
  });

  it('treats a sole final-newline change as a change with the marker', () => {
    const patch = toUnifiedDiff('a', 'a\n');
    expect(patch).toContain('-a');
    expect(patch).toContain('+a');
    expect(patch).toContain('\\ No newline at end of file');
  });

  it('keeps unchanged context lines within three lines of a change', () => {
    const a = 'l1\nl2\nl3\nl4\nl5\nl6\nl7\n';
    const b = 'l1\nl2\nl3\nCHANGED\nl5\nl6\nl7\n';
    const patch = toUnifiedDiff(a, b);
    expect(patch).toContain(' l1');
    expect(patch).toContain(' l3');
    expect(patch).toContain('-l4');
    expect(patch).toContain('+CHANGED');
    expect(patch).toContain(' l7');
  });

  it('respects the ignore-whitespace lens', () => {
    expect(toUnifiedDiff('a\n  b  \n', 'a\nb\n', lens({ ignoreWhitespace: true }))).toBe('');
  });

  it('is terminator-agnostic: a pure CRLF↔LF change yields no patch lines', () => {
    // Line-ending-only differences are surfaced as a diagnostic, not a patch.
    expect(toUnifiedDiff('a\r\nb\r\n', 'a\nb\n')).toBe('');
  });

  it('diffs CRLF file content without the trailing carriage return', () => {
    const patch = toUnifiedDiff('a\r\nb\r\n', 'a\r\nB\r\n');
    expect(patch).toContain('-b');
    expect(patch).toContain('+B');
    expect(patch).not.toContain('\r');
  });
});
