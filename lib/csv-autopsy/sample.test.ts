import { describe, expect, it } from 'vitest';
import { analyzeCsv } from './index';
import { SAMPLE_CSV, SAMPLE_FILENAME } from './sample-data';
import type { CsvAnalysis, CsvFinding, FindingCategory } from './types';

const analysis: CsvAnalysis = analyzeCsv(SAMPLE_CSV, {
  fileName: SAMPLE_FILENAME,
  fileSize: SAMPLE_CSV.length,
});

function find(category: FindingCategory, titlePart: string): CsvFinding | undefined {
  return analysis.findings.find((f) => f.category === category && f.title.includes(titlePart));
}

describe('sample dataset — overview', () => {
  it('reads the basic shape correctly', () => {
    expect(analysis.overview.rows).toBe(16);
    expect(analysis.overview.columns).toBe(9);
    expect(analysis.overview.delimiterName).toBe('comma');
    expect(analysis.overview.headerDetected).toBe(true);
    expect(analysis.overview.duplicateRows).toBe(1);
    expect(analysis.overview.blankRows).toBe(0);
  });
});

describe('sample dataset — inferred types', () => {
  const type = (name: string) => analysis.columns.find((c) => c.name === name)!.dominantType;

  it('infers sensible dominant types', () => {
    expect(type('Salary')).toBe('integer');
    expect(type('Start Date')).toBe('date');
    expect(type('Active')).toBe('boolean');
    expect(type('Country')).toBe('text');
    expect(type('Employee ID')).toBe('text');
  });
});

describe('sample dataset — the intended findings surface', () => {
  it('flags the duplicated identifier on Employee ID (and only there)', () => {
    const dupKeys = analysis.findings.filter((f) => f.title.includes('Duplicated identifier'));
    expect(dupKeys).toHaveLength(1);
    expect(dupKeys[0]!.column).toBe('Employee ID');
    expect(dupKeys[0]!.severity).toBe('warning');
  });

  it('does NOT mistake Salary or Start Date for identifiers', () => {
    const dupKeys = analysis.findings.filter((f) => f.title.includes('Duplicated identifier'));
    expect(dupKeys.some((f) => f.column === 'Salary' || f.column === 'Start Date')).toBe(false);
  });

  it('flags the numeric anomaly in Salary and the bad date in Start Date', () => {
    const salary = find('type-integrity', 'do not match');
    expect(salary?.column).toBe('Salary');
    expect(salary?.examples.some((e) => e.value === '8O000')).toBe(true);

    const startDate = analysis.findings.find(
      (f) => f.category === 'type-integrity' && f.column === 'Start Date',
    );
    expect(startDate?.examples.some((e) => e.value === '2026-02-30')).toBe(true);
  });

  it('flags the exact duplicate row', () => {
    expect(find('duplicates', 'duplicate')?.severity).toBe('warning');
  });

  it('flags the mostly-blank Middle Initial and constant Country', () => {
    expect(find('completeness', 'Mostly blank')?.column).toBe('Middle Initial');
    expect(find('consistency', 'Constant')?.column).toBe('Country');
  });

  it('flags inconsistent capitalization and similar values', () => {
    const caps = analysis.findings.filter((f) => f.title.includes('capitalization'));
    expect(caps.map((f) => f.column).sort()).toEqual(['City', 'Department']);
    expect(find('consistency', 'similar')?.column).toBe('City');
  });

  it('flags leading/trailing whitespace and the padded/clean variant, and reports null-like tokens once', () => {
    expect(
      analysis.findings.some(
        (f) => f.category === 'whitespace' && f.title.includes('Leading or trailing'),
      ),
    ).toBe(true);
    // The distinct "same value padded and clean" finding (Austin) must fire too.
    expect(analysis.findings.some((f) => f.title.includes('Same value'))).toBe(true);
    const nullLike = analysis.findings.filter((f) => f.title.includes('Null-like'));
    expect(nullLike).toHaveLength(1);
    expect(nullLike[0]!.count).toBe(3);
  });

  it('does not flag the clean Yes/No boolean column as a type anomaly', () => {
    const active = analysis.columns.find((c) => c.name === 'Active')!;
    expect(active.dominantType).toBe('boolean');
    expect(active.anomalyCount).toBe(0);
    expect(analysis.findings.some((f) => f.column === 'Active')).toBe(false);
  });

  it('surfaces the warnings before the notices before the info', () => {
    expect(analysis.overview.findingCountBySeverity.warning).toBeGreaterThanOrEqual(4);
    expect(analysis.findings[0]!.severity).toBe('warning');
  });
});
