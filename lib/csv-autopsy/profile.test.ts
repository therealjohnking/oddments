import { describe, expect, it } from 'vitest';
import { parseCsv } from './parse';
import { buildColumnProfile, detectDuplicateRows, scanColumns } from './profile';
import type { ColumnProfile } from './types';

function profile(csv: string): ColumnProfile[] {
  const parsed = parseCsv(csv);
  return scanColumns(parsed).map((scan) => buildColumnProfile(scan, parsed));
}

function byName(cols: ColumnProfile[], name: string): ColumnProfile {
  const found = cols.find((c) => c.name === name);
  if (!found) throw new Error(`no column ${name}`);
  return found;
}

// A 10-row fixture exercising most profile facets.
const FIXTURE = `id,score,when,flag,city,note
1,10,2020-01-01,yes,Denver,alpha
2,20,2020-02-01,no,denver,beta
3,30,2020-03-01,yes,Denver,gamma
4,40,2020-04-01,no,Denver,delta
5,50,2020-05-01,yes,Denver,epsilon
6,60,2020-06-01,no,Denver,zeta
7,70,2020-07-01,yes,Denver,eta
8,80,2020-08-01,no,Denver,theta
9,90,2020-09-01,yes,Denver,iota
10,oops,2020-10-01,no,Denver,kappa
`;

describe('buildColumnProfile — core metrics', () => {
  const cols = profile(FIXTURE);

  it('computes completeness, distinctness, and uniqueness', () => {
    const id = byName(cols, 'id');
    expect(id.populated).toBe(10);
    expect(id.completeness).toBe(1);
    expect(id.distinct).toBe(10);
    expect(id.uniqueness).toBe(1);
  });

  it('detects a candidate key on a fully-populated, fully-unique id column', () => {
    expect(byName(cols, 'id').candidateKey).toBe('strong');
  });

  it('keeps a dominant numeric type and surfaces the non-conforming value', () => {
    const score = byName(cols, 'score');
    expect(score.dominantType).toBe('integer');
    expect(score.typeConformity).toBeCloseTo(0.9, 5);
    expect(score.anomalyCount).toBe(1);
    expect(score.anomalyExamples[0]).toMatchObject({ value: 'oops', row: 10 });
    expect(score.numeric).toBeTruthy();
    expect(score.numeric!.max).toBe(90);
  });

  it('infers a date column with a range', () => {
    const when = byName(cols, 'when');
    expect(when.dominantType).toBe('date');
    expect(when.dates).toMatchObject({ earliest: '2020-01-01', latest: '2020-10-01' });
  });

  it('infers a boolean column from yes/no', () => {
    expect(byName(cols, 'flag').dominantType).toBe('boolean');
  });
});

describe('buildColumnProfile — special shapes', () => {
  it('marks a constant column', () => {
    const constant = byName(profile('id,region\n1,US\n2,US\n3,US\n4,US\n5,US\n'), 'region');
    expect(constant.isConstant).toBe(true);
    expect(constant.distinct).toBe(1);
  });

  it('marks a completely empty column', () => {
    const cols = profile('id,extra\n1,\n2,\n3,\n4,\n');
    expect(byName(cols, 'extra').populated).toBe(0);
    expect(byName(cols, 'extra').dominantType).toBe('empty');
  });

  it('does not treat long unique free text as an identifier', () => {
    const rows = Array.from(
      { length: 10 },
      (_, i) => `${i},This is a reasonably long free-form sentence number ${i}`,
    );
    const cols = profile('id,description\n' + rows.join('\n') + '\n');
    const desc = byName(cols, 'description');
    expect(desc.uniqueness).toBe(1);
    expect(desc.candidateKey).toBe('none');
  });

  it('counts null-like tokens as blank, not populated', () => {
    const cols = profile('id,status\n1,active\n2,N/A\n3,active\n4,NULL\n5,active\n');
    const status = byName(cols, 'status');
    expect(status.nullLike).toBe(2);
    expect(status.populated).toBe(3);
  });

  it('treats values that differ in any way as genuinely distinct', () => {
    // Whitespace and punctuation differences are real string differences.
    const cols = profile('id,place\n1,Ohio\n2,Ohio \n3, Ohio\n4,St. Louis\n5,St Louis\n');
    const place = byName(cols, 'place');
    expect(place.distinct).toBe(5); // "Ohio", "Ohio ", " Ohio", "St. Louis", "St Louis"
    expect(place.uniqueness).toBe(1);
  });
});

describe('buildColumnProfile — boolean shapes', () => {
  it('reads a 0/1 column as boolean with no type anomalies', () => {
    const flag = byName(profile('id,flag\n1,1\n2,0\n3,1\n4,0\n5,1\n6,0\n7,1\n8,0\n'), 'flag');
    expect(flag.dominantType).toBe('boolean');
    expect(flag.anomalyCount).toBe(0);
    expect(flag.typeConformity).toBe(1);
  });

  it('reads a y/n column as boolean with no type anomalies', () => {
    const active = byName(profile('id,active\n1,y\n2,n\n3,y\n4,n\n5,y\n6,n\n'), 'active');
    expect(active.dominantType).toBe('boolean');
    expect(active.anomalyCount).toBe(0);
  });

  it('still flags a genuine straggler in a true/false column', () => {
    const cols = profile(
      'id,ok\n1,true\n2,false\n3,true\n4,false\n5,true\n6,maybe\n7,true\n8,false\n9,true\n10,false\n',
    );
    const ok = byName(cols, 'ok');
    expect(ok.dominantType).toBe('boolean');
    expect(ok.anomalyCount).toBe(1);
    expect(ok.anomalyExamples[0]).toMatchObject({ value: 'maybe' });
  });
});

describe('buildColumnProfile — date parse rate', () => {
  it('reports a parse rate below 1 when some populated values are not dates', () => {
    const rows = Array.from({ length: 9 }, (_, i) => `${i},2020-0${i + 1}-01`).join('\n');
    const cols = profile('id,when\n' + rows + '\n9,not-a-date\n');
    const when = byName(cols, 'when');
    expect(when.dominantType).toBe('date');
    expect(when.dates!.parseRate).toBeCloseTo(0.9, 5);
    expect(when.dates!.parsed).toBe(9);
  });
});

describe('detectDuplicateRows', () => {
  it('counts exact duplicate rows and groups, excluding blank rows', () => {
    const parsed = parseCsv('a,b\n1,2\n1,2\n3,4\n1,2\n\n');
    const dup = detectDuplicateRows(parsed);
    expect(dup.duplicateRows).toBe(2); // "1,2" appears 3× → 2 extra copies
    expect(dup.duplicateGroups).toBe(1);
    expect(dup.groups[0]!.count).toBe(3);
  });

  it('does not collide rows with different field boundaries', () => {
    // ["1","23"] and ["12","3"] must not be treated as duplicates.
    const dup = detectDuplicateRows(parseCsv('a,b\n1,23\n12,3\n4,5\n'));
    expect(dup.duplicateRows).toBe(0);
    expect(dup.duplicateGroups).toBe(0);
  });
});
