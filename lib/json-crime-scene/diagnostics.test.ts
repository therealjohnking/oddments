import { describe, expect, it } from 'vitest';
import { analyzeJson } from './index';
import type { JsonFinding } from './types';

function findingsOf(source: string): JsonFinding[] {
  const analysis = analyzeJson(source);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis.findings;
}

function find(source: string, id: string): JsonFinding | undefined {
  return findingsOf(source).find((f) => f.id === id);
}

function ids(source: string): string[] {
  return findingsOf(source).map((f) => f.id);
}

describe('diagnostics — keys', () => {
  it('flags duplicate object keys as a warning', () => {
    const finding = find('{"a":1,"a":2}', 'dup-keys');
    expect(finding?.severity).toBe('warning');
    expect(finding?.count).toBe(1);
  });

  it('flags leading/trailing whitespace in keys', () => {
    expect(find('{"a ":1,"b":2}', 'keys-whitespace')?.count).toBe(1);
  });

  it('lists duplicate-key groups in document order', () => {
    const finding = find('{"first":{"a":1,"a":2},"second":{"b":1,"b":2}}', 'dup-keys');
    expect(finding?.pointer).toBe('/first');
    expect(finding?.examples.map((e) => e.pointer)).toEqual(['/first', '/second']);
  });

  it('reports distinct lines (not one entry per occurrence) for same-line duplicates', () => {
    const note = find('{"a":1,"a":2,"a":3}', 'dup-keys')?.examples[0]?.note ?? '';
    expect(note).toContain('line 1');
    expect(note).not.toContain('1, 1');
  });

  it('flags case-only sibling collisions', () => {
    expect(find('{"id":1,"ID":2}', 'keys-case')?.count).toBe(1);
  });

  it('does not treat exact duplicates as case collisions', () => {
    expect(ids('{"a":1,"a":2}')).not.toContain('keys-case');
  });

  it('flags an empty property name as info', () => {
    expect(find('{"":1}', 'keys-empty')?.severity).toBe('info');
  });

  it('flags an invisible character in a key', () => {
    const finding = find('{"\\u200bx":1}', 'keys-hidden');
    expect(finding).toBeDefined();
    expect(finding?.examples[0]?.note).toMatch(/U\+200B/);
  });
});

describe('diagnostics — arrays and types', () => {
  it('flags mixed element types as a notice, not an error', () => {
    const finding = find('[1,"2",true]', 'types-mixed-array');
    expect(finding?.severity).toBe('notice');
    expect(finding?.title).toMatch(/mixed/i);
  });

  it('does not call an array of one type plus null "mixed"', () => {
    expect(ids('[1,2,null,3]')).not.toContain('types-mixed-array');
  });

  it('flags inconsistent object shapes', () => {
    const finding = find('[{"id":1,"name":"a"},{"id":2,"name":"b"},{"id":3}]', 'shape-root');
    expect(finding?.severity).toBe('notice');
  });

  it('flags inconsistent field types with the offending path', () => {
    const finding = find('[{"amount":1},{"amount":2},{"amount":"x"}]', 'types-field-root');
    expect(finding?.detail).toMatch(/\/2\/amount/);
  });
});

describe('diagnostics — null and emptiness', () => {
  it('flags a frequently-null field', () => {
    expect(find('[{"n":null},{"n":null},{"n":null},{"n":1}]', 'null-root')).toBeDefined();
  });

  it('flags empty arrays and objects only when they form a pattern', () => {
    expect(ids('{"a":[],"b":[],"c":[]}')).toContain('empty-arrays');
    expect(ids('{"a":{},"b":{},"c":{}}')).toContain('empty-objects');
    // A single empty array is not a finding.
    expect(ids('{"a":[]}')).not.toContain('empty-arrays');
  });

  it('flags dominant empty strings', () => {
    expect(ids('["","","","","",""]')).toContain('empty-strings');
  });
});

describe('diagnostics — numbers', () => {
  it('flags integers outside the safe range as a warning', () => {
    const finding = find('{"id":9223372036854775807}', 'numbers-unsafe');
    expect(finding?.severity).toBe('warning');
    expect(finding?.examples[0]?.label).toBe('9223372036854775807');
  });

  it('does not flag ordinary numbers', () => {
    expect(ids('{"a":1,"b":-2.5,"c":1e6}')).not.toContain('numbers-unsafe');
  });

  it('says "rounds to" only when the value actually changes, else "beyond the safe range"', () => {
    // 2^53 is outside the safe range but exactly representable (no rounding).
    const exact = find('{"n":9007199254740992}', 'numbers-unsafe');
    expect(exact?.examples[0]?.note).toMatch(/beyond the safe range/);
    // This 19-digit integer genuinely rounds to a different value.
    const lossy = find('{"n":9223372036854775807}', 'numbers-unsafe');
    expect(lossy?.examples[0]?.note).toMatch(/rounds to/);
  });
});

describe('diagnostics — strings', () => {
  it('flags an invisible character in a string value', () => {
    const finding = find('{"a":"x\\u200by"}', 'strings-hidden');
    expect(finding?.examples[0]?.note).toMatch(/U\+200B/);
  });
});

describe('diagnostics — structural hotspots', () => {
  it('flags deep nesting (informational)', () => {
    const deep = '['.repeat(16) + '1' + ']'.repeat(16);
    const finding = find(deep, 'structure-depth');
    expect(finding?.severity).toBe('info');
    expect(finding?.count).toBe(16);
  });

  it('flags a large array', () => {
    const arr = '[' + Array.from({ length: 1000 }, () => '0').join(',') + ']';
    expect(find(arr, 'size-array')?.count).toBe(1000);
  });

  it('flags an object with many properties', () => {
    const obj = '{' + Array.from({ length: 100 }, (_, i) => `"k${i}":${i}`).join(',') + '}';
    expect(find(obj, 'size-object')?.count).toBe(100);
  });

  it('flags a very long string', () => {
    const src = `{"s":"${'a'.repeat(8192)}"}`;
    expect(find(src, 'size-string')?.count).toBe(8192);
  });
});

describe('diagnostics — clean input and ordering', () => {
  it('produces no findings for ordinary, consistent JSON', () => {
    expect(findingsOf('{"a":1,"b":"hi","c":[1,2,3],"d":{"e":true}}')).toHaveLength(0);
  });

  it('sorts warnings ahead of notices and info', () => {
    const findings = findingsOf('{"id":9223372036854775807,"a":1,"a":2}');
    expect(findings[0]?.severity).toBe('warning');
  });
});
