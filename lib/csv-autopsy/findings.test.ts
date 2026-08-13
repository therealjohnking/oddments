import { describe, expect, it } from 'vitest';
import { analyzeCsv } from './index';
import type { CsvFinding, FindingCategory, FindingSeverity } from './types';

function findingsFor(csv: string): CsvFinding[] {
  return analyzeCsv(csv).findings;
}

function find(
  findings: CsvFinding[],
  category: FindingCategory,
  titlePart: string,
): CsvFinding | undefined {
  return findings.find((f) => f.category === category && f.title.includes(titlePart));
}

describe('findings — structure', () => {
  it('flags malformed rows as a warning', () => {
    const f = find(findingsFor('a,b,c\n1,2,3\n4,5\n6,7,8\n9,10,11\n'), 'structure', 'Malformed');
    expect(f?.severity).toBe('warning');
    expect(f?.count).toBe(1);
  });

  it('flags blank rows as info', () => {
    const f = find(findingsFor('a,b\n1,2\n\n3,4\n5,6\n'), 'structure', 'Blank rows');
    expect(f?.severity).toBe('info');
  });

  it('reports an unclosed quoted field', () => {
    const f = find(findingsFor('a,b\n"open,2\n3,4\n5,6\n'), 'structure', 'Unclosed');
    expect(f?.severity).toBe('warning');
  });
});

describe('findings — uniqueness', () => {
  const dupIdCsv = `user_id,name
u1,a
u2,b
u3,c
u4,d
u5,e
u6,f
u7,g
u8,h
u9,i
u3,j
`;

  it('flags a duplicated identifier as a warning', () => {
    const f = find(findingsFor(dupIdCsv), 'uniqueness', 'Duplicated identifier');
    expect(f?.severity).toBe('warning');
    expect(f?.column).toBe('user_id');
    expect(f?.count).toBe(1);
  });

  it('does not flag an ordinary measure with one coincidental repeat as an identifier', () => {
    const csv = `label,amount
a,10
b,20
c,30
d,40
e,50
f,60
g,70
h,80
i,90
j,90
`;
    expect(find(findingsFor(csv), 'uniqueness', 'Duplicated identifier')).toBeUndefined();
  });

  it('reports a clean id column as a possible identifier (info)', () => {
    const csv = `id,name\n1,a\n2,b\n3,c\n4,d\n5,e\n6,f\n7,g\n8,h\n9,i\n10,j\n`;
    const f = find(findingsFor(csv), 'uniqueness', 'identifier');
    expect(f?.severity).toBe('info');
  });

  it('does not treat a weakly-named category (area_code) with a repeat as a broken key', () => {
    // "code" is a weak id-ish name; area codes legitimately repeat, so a single
    // repeat at 90% uniqueness must NOT fire a duplicated-identifier warning.
    const csv = `area_code,city
303,Denver
415,SF
212,NYC
303,Aurora
650,Palo Alto
206,Seattle
312,Chicago
617,Boston
713,Houston
305,Miami
`;
    expect(find(findingsFor(csv), 'uniqueness', 'Duplicated identifier')).toBeUndefined();
  });
});

describe('findings — boolean columns are not anomalies', () => {
  it('does not emit a type-integrity finding for a 0/1 column', () => {
    const csv = `id,flag\n1,1\n2,0\n3,1\n4,0\n5,1\n6,0\n7,1\n8,0\n`;
    const typeFindings = findingsFor(csv).filter((f) => f.category === 'type-integrity');
    expect(typeFindings).toHaveLength(0);
  });
});

describe('findings — type integrity', () => {
  it('flags non-conforming values in a dominant-typed column', () => {
    const csv = `id,amount\n1,10\n2,20\n3,30\n4,40\n5,50\n6,60\n7,70\n8,80\n9,90\n10,oops\n`;
    const f = find(findingsFor(csv), 'type-integrity', 'do not match');
    expect(f?.severity).toBe('warning');
    expect(f?.column).toBe('amount');
    expect(f?.examples[0]).toMatchObject({ value: 'oops' });
  });
});

describe('findings — completeness & consistency', () => {
  it('flags a mostly-blank column', () => {
    const rows = Array.from({ length: 20 }, (_, i) => `${i},`);
    const csv = 'id,extra\n' + rows.slice(0, 19).join('\n') + '\n19,x\n';
    const f = find(findingsFor(csv), 'completeness', 'Mostly blank');
    expect(f?.severity).toBe('notice');
  });

  it('reports recognized null-like tokens once, at the dataset level', () => {
    const csv = `id,a,b\n1,N/A,x\n2,y,NULL\n3,z,w\n4,q,r\n`;
    const nullFindings = findingsFor(csv).filter((f) => f.title.includes('Null-like'));
    expect(nullFindings).toHaveLength(1);
    expect(nullFindings[0]!.severity).toBe('info');
  });

  it('flags inconsistent capitalization as a cluster', () => {
    const csv = `id,city\n1,Denver\n2,denver\n3,DENVER\n4,Denver\n5,Austin\n`;
    const f = find(findingsFor(csv), 'consistency', 'capitalization');
    expect(f?.severity).toBe('notice');
    expect(f?.count).toBe(1);
  });

  it('flags a constant column as info', () => {
    const csv = `id,country\n1,US\n2,US\n3,US\n4,US\n5,US\n`;
    const f = find(findingsFor(csv), 'consistency', 'Constant');
    expect(f?.severity).toBe('info');
  });

  it('reports a whitespace-only variant as whitespace, not "suspiciously similar"', () => {
    // "Austin" and "Austin " differ only by whitespace: that is a whitespace
    // issue, not a punctuation/spelling similarity.
    const csv = `id,city\n1,Austin\n2,Austin \n3,Austin\n4,Dallas\n5,Houston\n`;
    const findings = findingsFor(csv);
    expect(findings.some((f) => f.title.includes('similar'))).toBe(false);
    expect(findings.some((f) => f.category === 'whitespace')).toBe(true);
  });

  it('still reports a genuine punctuation/spelling variant as suspiciously similar', () => {
    const csv = `id,city\n1,St. Louis\n2,St Louis\n3,St. Louis\n4,Dallas\n5,Houston\n`;
    expect(find(findingsFor(csv), 'consistency', 'similar')?.column).toBe('city');
  });
});

describe('findings — whitespace', () => {
  it('flags leading/trailing whitespace with exact examples', () => {
    const csv = 'id,name\n1, Ada \n2,Grace\n3,Alan\n4,Edsger\n';
    const f = find(findingsFor(csv), 'whitespace', 'whitespace');
    expect(f?.severity).toBe('notice');
    expect(f?.examples[0]!.value).toContain('Ada');
  });
});

describe('findings — headers', () => {
  it('flags duplicate column names as a warning', () => {
    const f = find(
      findingsFor('Amount,Amount,note\n1,2,x\n3,4,y\n5,6,z\n'),
      'headers',
      'Duplicate',
    );
    expect(f?.severity).toBe('warning');
  });

  it('flags blank column names', () => {
    const f = find(findingsFor('id,,note\n1,2,x\n3,4,y\n5,6,z\n'), 'headers', 'Blank');
    expect(f).toBeTruthy();
  });
});

describe('findings — duplicates', () => {
  it('flags exact duplicate rows as a warning', () => {
    const f = find(findingsFor('a,b\n1,2\n3,4\n1,2\n5,6\n'), 'duplicates', 'duplicate');
    expect(f?.severity).toBe('warning');
    expect(f?.count).toBe(1);
  });
});

describe('findings — cleanliness & ordering', () => {
  it('produces no findings for clean data', () => {
    expect(findingsFor('id,amount\n1,100\n2,200\n3,300\n4,400\n')).toHaveLength(0);
  });

  it('orders findings by severity tier then category', () => {
    const findings = analyzeCsv(`Amount,Amount\n1, Ada \n2,x\n3,y\n1, Ada \n`).findings;
    const tier: Record<FindingSeverity, number> = { warning: 0, notice: 1, info: 2 };
    for (let i = 1; i < findings.length; i++) {
      expect(tier[findings[i - 1]!.severity]).toBeLessThanOrEqual(tier[findings[i]!.severity]);
    }
  });
});
