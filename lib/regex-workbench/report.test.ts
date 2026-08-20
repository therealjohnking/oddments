import { describe, expect, it } from 'vitest';
import { compilePattern } from './compile';
import { computeDiagnostics } from './diagnostics';
import { executeRegex } from './execute';
import { enrichMatches } from './matches';
import { toDiagnosticSummary } from './report';
import type { CompileOk } from './types';

function build(source: string, flags: string, text: string) {
  const compiled = compilePattern(source, flags) as CompileOk;
  const raw = executeRegex({ source, flags: compiled.execFlags, text, cap: 1000 });
  if (!raw.ok) throw new Error('exec failed');
  const matches = enrichMatches(raw.matches, {
    text,
    groupNamesByNumber: compiled.groupNamesByNumber,
    global: flags.includes('g'),
    truncated: raw.truncated,
    cap: 1000,
  });
  const diagnostics = computeDiagnostics({ source, flags, canMatchEmpty: compiled.canMatchEmpty });
  return toDiagnosticSummary({ compile: compiled, matches, diagnostics });
}

describe('toDiagnosticSummary', () => {
  it('restates the pattern, matches, groups and UTF-16 note', () => {
    const summary = build('(?<y>\\d{4})', 'g', 'a2026b2027');
    expect(summary).toContain('JavaScript / ECMAScript');
    expect(summary).toContain('/(?<y>\\d{4})/g');
    expect(summary).toContain('Matches: 2');
    expect(summary).toContain('<y>');
    expect(summary).toContain('UTF-16');
  });

  it('reports a timeout instead of matches', () => {
    const compiled = compilePattern('a', '') as CompileOk;
    const matches = enrichMatches([], {
      text: 'x',
      groupNamesByNumber: [],
      global: false,
      truncated: false,
      cap: 1000,
      status: 'timeout',
    });
    const summary = toDiagnosticSummary({ compile: compiled, matches, diagnostics: [] });
    expect(summary).toContain('stopped by the safety timeout');
  });
});
