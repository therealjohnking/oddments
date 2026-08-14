import { describe, expect, it } from 'vitest';
import { analyzeJson, toJsonReport, toMarkdownReport } from './index';

describe('toMarkdownReport', () => {
  it('renders overview and findings sections', () => {
    const md = toMarkdownReport(analyzeJson('{"a":1,"a":2}'));
    expect(md).toContain('# JSON Crime Scene report');
    expect(md).toContain('## Overview');
    expect(md).toContain('## Findings');
    expect(md).toContain('Duplicate object keys');
  });

  it('does not embed the source document', () => {
    // Clean input → no findings → no value previews, so nothing leaks.
    const md = toMarkdownReport(analyzeJson('{"secret":"TOPSECRETVALUE"}'));
    expect(md).not.toContain('TOPSECRETVALUE');
  });

  it('notes an invalid document instead of profiling it', () => {
    const md = toMarkdownReport(analyzeJson('{"a":}'));
    expect(md).toMatch(/not valid JSON/i);
  });
});

describe('toJsonReport', () => {
  it('produces parseable JSON with the tool name and no source', () => {
    const json = toJsonReport(analyzeJson('{"a":1,"a":2}'));
    const parsed = JSON.parse(json);
    expect(parsed.tool).toBe('JSON Crime Scene');
    expect(Array.isArray(parsed.findings)).toBe(true);
    expect(parsed.overview.duplicateKeyGroups).toBe(1);
  });
});
