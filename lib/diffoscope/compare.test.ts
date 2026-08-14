import { describe, expect, it } from 'vitest';
import { diffInMode } from './compare';
import { EXACT_LENS } from './types';

const cp = (n: number) => String.fromCodePoint(n);

/** Compact "op:value" view of the segment stream. */
function view(a: string, b: string, mode: 'word' | 'char' | 'line', lens = EXACT_LENS, opts = {}) {
  return diffInMode(a, b, mode, lens, opts).segments.map((s) => `${s.op}:${s.value}`);
}

/** Reconstruct A (equal+delete) and B (equal+insert) from the segment stream. */
function reconstruct(a: string, b: string, mode: 'word' | 'char' | 'line') {
  const { segments } = diffInMode(a, b, mode, EXACT_LENS, { forceChar: true });
  let left = '';
  let right = '';
  for (const s of segments) {
    if (s.op === 'equal') {
      left += s.value;
      right += s.value;
    } else if (s.op === 'delete') {
      left += s.value;
    } else {
      right += s.value;
    }
  }
  return { left, right };
}

describe('diffInMode — word', () => {
  it('marks an inserted word', () => {
    expect(view('a b', 'a b c', 'word')).toContain('insert: c');
  });

  it('marks a deleted word', () => {
    expect(view('a b c', 'a b', 'word')).toContain('delete: c');
  });

  it('marks a replaced word', () => {
    const v = view('the quick fox', 'the slow fox', 'word');
    expect(v).toContain('delete:quick');
    expect(v).toContain('insert:slow');
  });

  it('isolates a punctuation change without dragging the word', () => {
    const v = view('hi.', 'hi!', 'word');
    expect(v).toContain('equal:hi');
    expect(v).toContain('delete:.');
    expect(v).toContain('insert:!');
  });

  it('handles repeated words', () => {
    const d = diffInMode('na na na batman', 'na na batman', 'word');
    expect(d.deleted).toBeGreaterThan(0);
    expect(reconstruct('na na na batman', 'na na batman', 'word')).toEqual({
      left: 'na na na batman',
      right: 'na na batman',
    });
  });

  it('reports exact insert/delete/region counts', () => {
    const d = diffInMode('one two three', 'one four three', 'word');
    expect(d.inserted).toBe(1);
    expect(d.deleted).toBe(1);
    expect(d.changedRegions).toBe(1);
    expect(d.equal).toBe(false);
  });
});

describe('diffInMode — char', () => {
  it('replaces a single ASCII character', () => {
    const v = view('abc', 'abd', 'char');
    expect(v).toContain('equal:ab');
    expect(v).toContain('delete:c');
    expect(v).toContain('insert:d');
  });

  it('does not corrupt an emoji when the neighbours change', () => {
    const emoji = cp(0x1f600);
    const { left, right } = reconstruct(`${emoji}x`, `${emoji}y`, 'char');
    expect(left).toBe(`${emoji}x`);
    expect(right).toBe(`${emoji}y`);
  });

  it('keeps a ZWJ family emoji intact across a change', () => {
    const family = cp(0x1f468) + cp(0x200d) + cp(0x1f469) + cp(0x200d) + cp(0x1f467);
    const { left, right } = reconstruct(`${family}!`, `${family}?`, 'char');
    expect(left).toBe(`${family}!`);
    expect(right).toBe(`${family}?`);
  });

  it('is gated off for very large input unless forced', () => {
    const big = 'x'.repeat(50);
    const gated = diffInMode(big, big + 'y', 'char', EXACT_LENS, { charSafeLimit: 10 });
    expect(gated.charDisabled).toBe(true);
    expect(gated.segments).toHaveLength(0);

    const forced = diffInMode(big, big + 'y', 'char', EXACT_LENS, {
      charSafeLimit: 10,
      forceChar: true,
    });
    expect(forced.charDisabled).toBe(false);
    expect(forced.inserted).toBe(1);
  });
});

describe('diffInMode — line', () => {
  it('marks an inserted line', () => {
    const d = diffInMode('a\nb\n', 'a\nx\nb\n', 'line');
    expect(d.segments.some((s) => s.op === 'insert' && s.value === 'x')).toBe(true);
  });

  it('marks a deleted line', () => {
    const d = diffInMode('a\nx\nb\n', 'a\nb\n', 'line');
    expect(d.segments.some((s) => s.op === 'delete' && s.value === 'x')).toBe(true);
  });

  it('marks a changed line as delete + insert', () => {
    const d = diffInMode('a\nold\nb\n', 'a\nnew\nb\n', 'line');
    expect(d.segments.some((s) => s.op === 'delete' && s.value === 'old')).toBe(true);
    expect(d.segments.some((s) => s.op === 'insert' && s.value === 'new')).toBe(true);
    expect(d.changedLines).toBe(2);
  });

  it('treats CRLF vs LF as equal in line mode (content only)', () => {
    const d = diffInMode('a\r\nb\r\nc', 'a\nb\nc', 'line');
    expect(d.equal).toBe(true);
  });

  it('surfaces a final-newline difference as an inserted empty line', () => {
    const d = diffInMode('a', 'a\n', 'line');
    expect(d.equal).toBe(false);
    expect(d.inserted).toBe(1);
  });

  it('carries 1-based line numbers on segments', () => {
    const d = diffInMode('a\nb', 'a\nb', 'line');
    expect(d.segments.map((s) => s.aLine)).toEqual([1, 2]);
  });
});

describe('diffInMode — equality and empties', () => {
  it('is equal for identical inputs', () => {
    const d = diffInMode('same text', 'same text', 'word');
    expect(d.equal).toBe(true);
    expect(d.inserted).toBe(0);
    expect(d.deleted).toBe(0);
  });

  it('handles empty vs empty', () => {
    const d = diffInMode('', '', 'word');
    expect(d.equal).toBe(true);
    expect(d.segments).toHaveLength(0);
  });

  it('handles empty vs non-empty as all inserts', () => {
    const d = diffInMode('', 'hello world', 'word');
    expect(d.deleted).toBe(0);
    expect(d.inserted).toBeGreaterThan(0);
    expect(d.segments.every((s) => s.op === 'insert')).toBe(true);
  });
});

describe('diffInMode — render cap', () => {
  it('caps rendered segments while keeping counts exact', () => {
    // Line mode keeps one segment per line (no coalescing), so 50 changed lines
    // produce many segments — enough to exercise the render cap.
    const a = Array.from({ length: 50 }, (_, i) => `a${i}`).join('\n');
    const b = Array.from({ length: 50 }, (_, i) => `b${i}`).join('\n');
    const d = diffInMode(a, b, 'line', EXACT_LENS, { maxRenderSegments: 5 });
    expect(d.renderCapped).toBe(true);
    expect(d.segments.length).toBeLessThanOrEqual(5);
    expect(d.deleted).toBe(50);
    expect(d.inserted).toBe(50);
  });
});
