import { describe, expect, it } from 'vitest';
import { transform } from './transform';
import type { Finding, FindingCategory } from './types';

function findingFor(findings: Finding[], category: FindingCategory): Finding | undefined {
  return findings.find((f) => f.category === category);
}

describe('report: aggregation', () => {
  it('emits one emphasis finding for many spans, with a correct count', () => {
    const { findings } = transform('**a** **b** **c** _d_', 'plain');
    const emphasis = findings.filter((f) => f.category === 'emphasis');
    expect(emphasis).toHaveLength(1);
    expect(emphasis[0]!.count).toBe(4);
  });

  it('describes formatting removal on a plain destination', () => {
    const f = findingFor(transform('**a** _b_ ~~c~~', 'plain').findings, 'emphasis');
    expect(f?.impact).toBe('compromised');
    expect(f?.detail).toMatch(/1 bold, 1 italic, 1 strikethrough/);
  });

  it('describes link expansion', () => {
    const f = findingFor(
      transform('[a](https://e.com) [b](https://f.com)', 'plain').findings,
      'links',
    );
    expect(f?.impact).toBe('adapted');
    expect(f?.count).toBe(2);
    expect(f?.detail).toMatch(/label \+ URL/);
  });

  it('describes a table adaptation and a preserved rich/reddit table', () => {
    const table = '| A | B | C | D | E | F |\n|---|---|---|---|---|---|\n| 1 | 2 | 3 | 4 | 5 | 6 |';
    expect(findingFor(transform(table, 'linkedin').findings, 'tables')?.title).toBe(
      'Table adapted',
    );
    expect(findingFor(transform(table, 'rich').findings, 'tables')?.title).toBe(
      'Rich table preserved',
    );
    expect(findingFor(transform(table, 'reddit').findings, 'tables')?.impact).toBe('preserved');
  });

  it('flags raw HTML as kept-as-text everywhere', () => {
    const f = findingFor(transform('<div>x</div>', 'rich').findings, 'html');
    expect(f?.impact).toBe('compromised');
    expect(f?.detail).toMatch(/literal text/);
  });

  it('words the links finding honestly when only some links are expanded', () => {
    const f = findingFor(
      transform('[docs](https://d.com) and <https://e.com>', 'plain').findings,
      'links',
    );
    expect(f?.detail).toMatch(/1 as label \+ URL/);
  });

  it('reports horizontal rules as an adaptation for plain, but not for rich/reddit', () => {
    expect(findingFor(transform('a\n\n---\n\nb', 'plain').findings, 'rules')?.impact).toBe(
      'adapted',
    );
    expect(findingFor(transform('a\n\n---\n\nb', 'plain').findings, 'rules')).toBeDefined();
    expect(findingFor(transform('a\n\n---\n\nb', 'rich').findings, 'rules')).toBeUndefined();
    expect(findingFor(transform('a\n\n---\n\nb', 'reddit').findings, 'rules')).toBeUndefined();
    // A rule-only doc to plain is now honestly 'Adapted', not 'Preserved'.
    expect(transform('---', 'plain').status.kind).toBe('adapted');
  });
});

describe('report: status classification', () => {
  it('is Preserved when nothing needed changing', () => {
    expect(transform('Just a plain paragraph.', 'plain').status.kind).toBe('preserved');
    expect(transform('# H\n\ntext', 'rich').status.kind).toBe('preserved');
  });

  it('is Adapted for faithful destination adjustments', () => {
    const status = transform('# Heading\n\n[l](https://e.com)', 'plain').status;
    expect(status.kind).toBe('adapted');
    expect(status.summary).toMatch(/adjustment/);
  });

  it('is a Formatting-compromise when emphasis or raw HTML has no representation', () => {
    expect(transform('**bold**', 'plain').status.kind).toBe('compromised');
    expect(transform('<b>x</b>', 'rich').status.kind).toBe('compromised');
  });

  it('does not treat ordinary adaptation as an error label', () => {
    const status = transform('# Heading', 'plain').status;
    expect(status.label).toBe('Adapted');
    expect(status.label.toLowerCase()).not.toContain('error');
  });
});
