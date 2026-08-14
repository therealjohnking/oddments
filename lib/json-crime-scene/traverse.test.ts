import { describe, expect, it } from 'vitest';
import { analyzeJson, PREVIEW_CAP, previewString } from './index';
import type { JsonNode } from './types';

function ok(source: string) {
  const analysis = analyzeJson(source);
  if (analysis.status !== 'ok') throw new Error(`expected ok, got ${analysis.status}`);
  return analysis;
}

function child(node: JsonNode, key: string): JsonNode {
  const found = (node.children ?? []).find((c) => c.key === key);
  if (!found) throw new Error(`no child ${key}`);
  return found;
}

describe('traverse — scalar nodes', () => {
  const { tree } = ok('{"a":1,"b":"hi","c":true,"d":null}');

  it('captures kind, preview, and typed value for each scalar', () => {
    expect(child(tree, 'a')).toMatchObject({
      kind: 'number',
      raw: '1',
      numberValue: 1,
      preview: '1',
    });
    expect(child(tree, 'b')).toMatchObject({ kind: 'string', preview: 'hi', stringLength: 2 });
    expect(child(tree, 'c')).toMatchObject({
      kind: 'boolean',
      booleanValue: true,
      preview: 'true',
    });
    expect(child(tree, 'd')).toMatchObject({ kind: 'null', preview: 'null' });
  });

  it('assigns JSON Pointers to members', () => {
    expect(child(tree, 'a').pointer).toBe('/a');
    expect(tree.pointer).toBe('');
  });
});

describe('traverse — arrays and awkward keys', () => {
  it('records array indexes and pointers', () => {
    const { tree } = ok('{"arr":[10,20]}');
    const arr = child(tree, 'arr');
    expect(arr.kind).toBe('array');
    expect(arr.children?.[0]).toMatchObject({ index: 0, pointer: '/arr/0', preview: '10' });
    expect(arr.children?.[1]).toMatchObject({ index: 1, pointer: '/arr/1', preview: '20' });
  });

  it('escapes / and ~ in member pointers', () => {
    const { tree } = ok('{"a/b":1,"c~d":2}');
    expect(child(tree, 'a/b').pointer).toBe('/a~1b');
    expect(child(tree, 'c~d').pointer).toBe('/c~0d');
  });
});

describe('traverse — duplicate keys', () => {
  it('preserves every occurrence and flags them', () => {
    const { tree, profile } = ok('{"x":1,"x":2}');
    expect(tree.children).toHaveLength(2);
    expect(tree.children?.every((c) => c.key === 'x')).toBe(true);
    expect(tree.children?.every((c) => c.duplicateKey === true)).toBe(true);
    expect(profile.duplicateKeyGroups).toBe(1);
  });
});

describe('traverse — precision and previews', () => {
  it('preserves the exact source literal of an unsafe integer', () => {
    const { tree } = ok('{"id":9223372036854775807}');
    const id = child(tree, 'id');
    expect(id.raw).toBe('9223372036854775807');
    // The parsed double no longer matches the exact digits — the raw literal is
    // what preserves them.
    expect(String(id.numberValue)).not.toBe('9223372036854775807');
  });

  it('truncates a long string preview but keeps the exact length', () => {
    const long = 'a'.repeat(300);
    const { tree } = ok(`{"s":"${long}"}`);
    const s = child(tree, 's');
    expect(s.stringLength).toBe(300);
    expect(s.truncatedPreview).toBe(true);
    expect((s.preview ?? '').length).toBeLessThanOrEqual(200);
  });

  it('reveals control characters in previews', () => {
    const { tree } = ok('{"s":"a\\nb\\tc"}');
    expect(child(tree, 's').preview).toBe('a\\nb\\tc');
    expect(child(tree, 's').stringLength).toBe(5);
  });

  it('escapes line/paragraph separators and C1 controls so previews stay single-line', () => {
    // U+2028 line separator, U+2029 paragraph separator, U+0085 NEL, U+000B VT.
    const { tree } = ok('{"s":"a\\u2028b\\u2029c\\u0085d\\u000be"}');
    expect(child(tree, 's').preview).toBe('a\\u2028b\\u2029c\\u0085d\\u000be');
  });

  it('never lets a preview exceed the cap, even when the final char escapes', () => {
    const value = 'x'.repeat(199) + String.fromCharCode(7); // 200th char (BEL) escapes to 6 units
    const { preview, truncated } = previewString(value);
    expect(preview.length).toBeLessThanOrEqual(PREVIEW_CAP);
    expect(truncated).toBe(true);
  });
});
