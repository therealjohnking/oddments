import { describe, expect, it } from 'vitest';
import { analyzeCsv, toJsonReport, toMarkdownReport } from './index';
import { SAMPLE_CSV } from './sample-data';

describe('analyzeCsv — empty and degenerate input', () => {
  it('reports an empty analysis for empty input', () => {
    const a = analyzeCsv('');
    expect(a.isEmpty).toBe(true);
    expect(a.columns).toHaveLength(0);
    expect(a.findings).toHaveLength(0);
  });

  it('treats whitespace-only input as empty', () => {
    expect(analyzeCsv('   \n   \n').isEmpty).toBe(true);
  });

  it('handles a header-only file without crashing', () => {
    const a = analyzeCsv('a,b,c\n');
    expect(a.isEmpty).toBe(false);
    expect(a.overview.rows).toBe(0);
    expect(a.columns).toHaveLength(3);
  });

  it('handles a single data row', () => {
    const a = analyzeCsv('1,2,3\n');
    expect(a.isEmpty).toBe(false);
    expect(a.overview.rows).toBe(1);
  });
});

describe('analyzeCsv — determinism', () => {
  it('produces identical results on repeated runs', () => {
    const a = analyzeCsv(SAMPLE_CSV);
    const b = analyzeCsv(SAMPLE_CSV);
    expect(JSON.stringify({ o: a.overview, c: a.columns, f: a.findings })).toBe(
      JSON.stringify({ o: b.overview, c: b.columns, f: b.findings }),
    );
  });
});

describe('analyzeCsv — caps keep exact counts', () => {
  it('caps stored examples while keeping the exact count', () => {
    const rows = Array.from({ length: 50 }, (_, i) => `${i}, name${i}`).join('\n');
    const a = analyzeCsv('id,name\n' + rows + '\n');
    const ws = a.findings.find(
      (f) => f.category === 'whitespace' && f.title.includes('whitespace'),
    );
    expect(ws?.count).toBe(50);
    expect(ws!.examples.length).toBeLessThan(50);
    expect(ws!.examplesTruncated).toBe(true);
  });

  it('truncates analysis for very large inputs and says so', () => {
    const rows = Array.from({ length: 100 }, (_, i) => `${i},x`).join('\n');
    const a = analyzeCsv('id,val\n' + rows + '\n', { maxRows: 10 });
    expect(a.overview.truncated).toBe(true);
    expect(a.overview.rows).toBe(10);
    expect(a.findings.some((f) => f.title.includes('truncated'))).toBe(true);
  });
});

describe('analyzeCsv — no score or health concept', () => {
  it('never introduces a score/grade/health field', () => {
    const a = analyzeCsv(SAMPLE_CSV);
    const serialized = JSON.stringify({ overview: a.overview, columns: a.columns });
    expect(serialized.toLowerCase()).not.toContain('score');
    expect(serialized.toLowerCase()).not.toContain('health');
    expect(serialized.toLowerCase()).not.toContain('grade');
    expect('score' in a.overview).toBe(false);
  });
});

describe('report export', () => {
  const analysis = analyzeCsv(SAMPLE_CSV, { fileName: 'x.csv', fileSize: SAMPLE_CSV.length });

  it('renders a Markdown report with overview, findings, and columns', () => {
    const md = toMarkdownReport(analysis);
    expect(md).toContain('# CSV Autopsy report');
    expect(md).toContain('## Overview');
    expect(md).toContain('## Findings');
    expect(md).toContain('## Columns');
    expect(md).toContain('Duplicated identifier values');
    expect(md.toLowerCase()).not.toContain('score');
  });

  it('renders a JSON report that parses and omits the raw dataset', () => {
    const parsed = JSON.parse(toJsonReport(analysis));
    expect(parsed.tool).toBe('CSV Autopsy');
    expect(parsed.overview.columns).toBe(9);
    expect(Array.isArray(parsed.findings)).toBe(true);
    // The raw data rows must never be part of the diagnostic report.
    expect(parsed.rows).toBeUndefined();
    expect(parsed.data).toBeUndefined();
  });
});
