import { describe, expect, it } from 'vitest';
import { compilePattern } from './compile';
import { computeDiagnostics } from './diagnostics';
import type { Diagnostic } from './types';

function diag(source: string, flags: string): Diagnostic[] {
  const compiled = compilePattern(source, flags);
  if (!compiled.ok) throw new Error('compile failed');
  return computeDiagnostics({ source, flags, canMatchEmpty: compiled.canMatchEmpty });
}

const ids = (ds: Diagnostic[]) => ds.map((d) => d.id);

describe('computeDiagnostics — empty match', () => {
  it('notes a pattern that can match empty (non-global)', () => {
    expect(ids(diag('a?', ''))).toContain('can-match-empty');
  });

  it('escalates to a global zero-width note when g is set', () => {
    const d = diag('a*', 'g');
    expect(ids(d)).toContain('global-zero-width');
    expect(ids(d)).not.toContain('can-match-empty');
  });

  it('does not flag a pattern that must consume input', () => {
    expect(ids(diag('abc', 'g'))).not.toContain('can-match-empty');
    expect(ids(diag('abc', 'g'))).not.toContain('global-zero-width');
  });
});

describe('computeDiagnostics — nested quantifier heuristic', () => {
  it('flags the classic catastrophic shapes', () => {
    expect(ids(diag('(a+)+', ''))).toContain('nested-quantifier');
    expect(ids(diag('(.*)*', ''))).toContain('nested-quantifier');
    expect(ids(diag('(\\w*)+', ''))).toContain('nested-quantifier');
    expect(ids(diag('(?:a?)*', ''))).toContain('nested-quantifier');
  });

  it('does not flag an ordinary single quantifier', () => {
    expect(ids(diag('.*', 'g'))).not.toContain('nested-quantifier');
    expect(ids(diag('\\d+', 'g'))).not.toContain('nested-quantifier');
    expect(ids(diag('a+b+c+', 'g'))).not.toContain('nested-quantifier');
  });

  it('does not flag a fixed-count inner quantifier', () => {
    expect(ids(diag('(?:a{2})+', ''))).not.toContain('nested-quantifier');
  });

  it('marks the risk as a warning without claiming vulnerability', () => {
    const d = diag('(a+)+', '');
    const found = d.find((x) => x.id === 'nested-quantifier')!;
    expect(found.severity).toBe('warning');
    expect(`${found.title} ${found.detail} ${found.why}`.toLowerCase()).not.toContain('vulnerable');
    expect(found.why?.toLowerCase()).toContain('heuristic');
  });
});
