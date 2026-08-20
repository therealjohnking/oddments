import { describe, expect, it } from 'vitest';
import { explainPattern } from './explain';
import type { ExplainNode } from './types';

function flatten(nodes: ExplainNode[]): ExplainNode[] {
  const out: ExplainNode[] = [];
  const walk = (n: ExplainNode) => {
    out.push(n);
    n.children?.forEach(walk);
  };
  nodes.forEach(walk);
  return out;
}

function explain(source: string, flags = '') {
  const result = explainPattern(source, flags);
  return { result, all: flatten(result.nodes) };
}

function find(all: ExplainNode[], kind: ExplainNode['kind']): ExplainNode | undefined {
  return all.find((n) => n.kind === kind);
}

describe('explainPattern — atoms', () => {
  it('explains literal characters', () => {
    const { result, all } = explain('abc');
    expect(result.status).toBe('ok');
    const literals = all.filter((n) => n.kind === 'literal');
    expect(literals).toHaveLength(3);
    expect(literals[0]!.title).toContain('“a”');
  });

  it('explains shorthand character sets', () => {
    expect(find(explain('\\d').all, 'char-set')!.title).toBe('A digit');
    expect(find(explain('\\w').all, 'char-set')!.title).toBe('A word character');
    expect(find(explain('\\s').all, 'char-set')!.title).toContain('whitespace');
    expect(find(explain('\\D').all, 'char-set')!.title).toContain('non-digit');
  });

  it('explains the dot, honoring the s flag', () => {
    expect(find(explain('.').all, 'char-set')!.detail).toContain('except line terminators');
    expect(find(explain('.', 's').all, 'char-set')!.detail).toContain('including line terminators');
  });

  it('explains a Unicode property escape', () => {
    const node = find(explain('\\p{Letter}', 'u').all, 'char-set')!;
    expect(node.title).toContain('Unicode property');
    expect(node.title).toContain('Letter');
  });
});

describe('explainPattern — classes', () => {
  it('explains a character class and its members', () => {
    const { all } = explain('[abc]');
    const cls = find(all, 'char-class')!;
    expect(cls.title).toBe('Any one of');
    expect(cls.children).toHaveLength(3);
  });

  it('explains a negated class', () => {
    expect(find(explain('[^abc]').all, 'char-class')!.title).toBe('Any character except');
  });

  it('explains ranges', () => {
    const range = find(explain('[a-z]').all, 'class-range')!;
    expect(range.title).toContain('Range');
    expect(range.title).toContain('“a”');
    expect(range.title).toContain('“z”');
  });

  it('explains v-mode set operations', () => {
    const op = find(explain('[\\p{ASCII}&&\\p{L}]', 'v').all, 'class-op');
    expect(op?.title).toContain('intersection');
  });
});

describe('explainPattern — quantifiers', () => {
  it('names the common quantifiers', () => {
    expect(find(explain('a+').all, 'quantifier')!.title).toBe('One or more of');
    expect(find(explain('a*').all, 'quantifier')!.title).toBe('Zero or more of');
    expect(find(explain('a?').all, 'quantifier')!.title).toContain('Optional');
    expect(find(explain('a{4}').all, 'quantifier')!.title).toBe('Exactly 4 of');
    expect(find(explain('a{2,4}').all, 'quantifier')!.title).toBe('Between 2 and 4 of');
    expect(find(explain('a{2,}').all, 'quantifier')!.title).toBe('2 or more of');
  });

  it('distinguishes greedy from lazy', () => {
    expect(find(explain('a+').all, 'quantifier')!.detail).toContain('greedy');
    expect(find(explain('a+?').all, 'quantifier')!.detail).toContain('lazy');
  });
});

describe('explainPattern — groups and alternation', () => {
  it('explains non-capturing, capturing and named groups', () => {
    expect(find(explain('(?:a)').all, 'group')!.title).toContain('non-capturing');
    expect(find(explain('(a)').all, 'capture')!.title).toBe('Capture group 1');
    const named = find(explain('(?<year>a)').all, 'named-capture')!;
    expect(named.title).toContain('year');
    expect(named.title).toContain('1');
  });

  it('numbers capture groups in source order', () => {
    const { all } = explain('(a)(b)');
    const captures = all.filter((n) => n.kind === 'capture');
    expect(captures.map((c) => c.title)).toEqual(['Capture group 1', 'Capture group 2']);
  });

  it('explains alternation', () => {
    const alt = find(explain('a|b|c').all, 'alternation')!;
    expect(alt.title).toContain('3 options');
    expect(alt.children).toHaveLength(3);
  });
});

describe('explainPattern — assertions and backreferences', () => {
  it('explains anchors, honoring the m flag', () => {
    expect(find(explain('^').all, 'assertion')!.title).toContain('Start of the input');
    expect(find(explain('^', 'm').all, 'assertion')!.title).toContain('Start of a line');
    expect(find(explain('$').all, 'assertion')!.title).toContain('End of the input');
  });

  it('explains word boundaries', () => {
    expect(find(explain('\\b').all, 'assertion')!.title).toContain('word boundary');
    expect(find(explain('\\B').all, 'assertion')!.title).toContain('Not a word boundary');
  });

  it('explains lookaround with direction and negation', () => {
    expect(find(explain('(?=a)').all, 'lookaround')!.title).toBe('Followed by');
    expect(find(explain('(?!a)').all, 'lookaround')!.title).toBe('Not followed by');
    expect(find(explain('(?<=a)').all, 'lookaround')!.title).toBe('Preceded by');
    expect(find(explain('(?<!a)').all, 'lookaround')!.title).toBe('Not preceded by');
  });

  it('explains numbered and named backreferences', () => {
    expect(find(explain('(a)\\1').all, 'backreference')!.title).toContain('group 1');
    expect(find(explain('(?<n>a)\\k<n>').all, 'backreference')!.title).toContain('“n”');
  });
});

describe('explainPattern — edge cases', () => {
  it('describes the empty pattern', () => {
    const { result } = explain('');
    expect(result.status).toBe('ok');
    expect(result.nodes[0]!.title).toContain('Empty');
  });

  it('preserves nesting depth', () => {
    // Quantifier > capture > class → three levels deep.
    const { result } = explain('([a-z]+)*');
    const top = result.nodes[0]!;
    expect(top.kind).toBe('quantifier');
    expect(top.children?.[0]!.kind).toBe('capture');
  });

  it('honors inline modifier groups when annotating . and anchors', () => {
    // (?s:.) turns on dotAll for the dot inside, with no top-level s flag.
    const dot = find(explain('(?s:.)').all, 'char-set')!;
    expect(dot.detail).toContain('including line terminators');
    // A plain dot with no modifier keeps the default meaning.
    expect(find(explain('.').all, 'char-set')!.detail).toContain('except line terminators');
    // (?m:^) makes the anchor per-line.
    expect(find(explain('(?m:^)').all, 'assertion')!.title).toContain('Start of a line');
  });
});
