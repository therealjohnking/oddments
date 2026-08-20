import { describe, expect, it } from 'vitest';
import { applyReplacement, explainReplacement } from './replace';

function replace(source: string, flags: string, text: string, replacement: string, matchCount = 1) {
  return applyReplacement({ source, flags, text, replacement, matchCount, truncated: false });
}

describe('applyReplacement — JS semantics', () => {
  it('performs an ordinary literal replacement', () => {
    expect(replace('cat', 'g', 'cat cat', 'dog', 2).output).toBe('dog dog');
  });

  it('replaces only the first match without g', () => {
    const r = replace('a', '', 'aaa', 'X', 1);
    expect(r.output).toBe('Xaa');
    expect(r.global).toBe(false);
    expect(r.count).toBe(1);
  });

  it('replaces all matches with g', () => {
    const r = replace('a', 'g', 'aaa', 'X', 3);
    expect(r.output).toBe('XXX');
    expect(r.count).toBe(3);
  });

  it('supports $& (whole match)', () => {
    expect(replace('\\d+', 'g', 'a12', '[$&]', 1).output).toBe('a[12]');
  });

  it('supports $1 (numbered group)', () => {
    expect(replace('(\\w)(\\w)', '', 'ab', '$2$1').output).toBe('ba');
  });

  it('supports $<name> (named group)', () => {
    const r = replace('(?<a>\\w)(?<b>\\w)', '', 'ab', '$<b>$<a>');
    expect(r.output).toBe('ba');
  });

  it("supports $` and $' (prefix and suffix)", () => {
    expect(replace('b', '', 'abc', '$`').output).toBe('aac'); // b → prefix "a"
    expect(replace('b', '', 'abc', "$'").output).toBe('acc'); // b → suffix "c"
  });

  it('supports $$ (literal dollar)', () => {
    expect(replace('a', '', 'a', '$$').output).toBe('$');
  });

  it('reports whether anything changed', () => {
    expect(replace('z', 'g', 'abc', 'X', 0).changed).toBe(false);
    expect(replace('a', 'g', 'abc', 'X', 1).changed).toBe(true);
  });
});

describe('explainReplacement — token analysis', () => {
  it('labels the standard tokens', () => {
    const tokens = explainReplacement('$<last>, $1 $& $$', 2, ['last']);
    const kinds = tokens.map((t) => t.kind);
    expect(kinds).toContain('named');
    expect(kinds).toContain('group');
    expect(kinds).toContain('match');
    expect(kinds).toContain('literal-dollar');
    expect(kinds).toContain('text');
  });

  it('marks an out-of-range group as inert', () => {
    const tokens = explainReplacement('$7', 2, []);
    expect(tokens[0]!.kind).toBe('unknown-group');
  });

  it('marks an unknown named group as inert (when the pattern has named groups)', () => {
    const tokens = explainReplacement('$<nope>', 1, ['real']);
    expect(tokens[0]!.kind).toBe('unknown-named');
  });

  it('leaves $<name> entirely literal when the pattern has no named groups', () => {
    // JS only treats `$<…>` as special when the regex actually has named groups.
    const tokens = explainReplacement('$<foo>', 2, []);
    expect(tokens.every((t) => t.kind === 'text')).toBe(true);
    expect(tokens.map((t) => t.raw).join('')).toBe('$<foo>');
  });

  it('agrees with real JS that $<name> is literal without named groups', () => {
    expect(replace('a', '', 'a', '$<x>').output).toBe('$<x>');
  });

  it('prefers a valid two-digit group reference', () => {
    const names: string[] = [];
    const tokens = explainReplacement('$12', 12, names);
    expect(tokens[0]).toMatchObject({ kind: 'group', raw: '$12' });
  });
});
