import { describe, expect, it } from 'vitest';
import { analyzePair } from './index';
import { diffInMode } from './compare';
import { toSummaryReport } from './export';

describe('toSummaryReport', () => {
  it('states the verdict and per-side stats', () => {
    const analysis = analyzePair('hello world', 'hello there');
    const report = toSummaryReport(analysis, diffInMode('hello world', 'hello there', 'word'));
    expect(report).toContain('Diffoscope comparison');
    expect(report).toContain('Verdict:');
    expect(report).toContain('A / Before:');
    expect(report).toContain('B / After:');
  });

  it('never emits the literal "undefined" for column-less findings', () => {
    // A line-ending finding carries a line number but no column.
    const analysis = analyzePair('a\r\nb\r\nc', 'a\nb\nc');
    const report = toSummaryReport(analysis);
    expect(report).toContain('Line-ending style differs');
    expect(report).not.toContain('undefined');
    expect(report).toMatch(/ln\d+/);
  });

  it('reports exact equality plainly', () => {
    const analysis = analyzePair('same', 'same');
    expect(toSummaryReport(analysis)).toContain('exactly identical');
  });
});
