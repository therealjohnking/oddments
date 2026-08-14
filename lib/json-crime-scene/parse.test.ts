import { describe, expect, it } from 'vitest';
import { LineIndex, parseDocument } from './parse';

function expectInvalid(source: string) {
  const outcome = parseDocument(source);
  if (outcome.kind !== 'invalid') throw new Error(`expected invalid, got ${outcome.kind}`);
  return outcome.error;
}

describe('parseDocument — valid input', () => {
  it('accepts objects, arrays, and scalar roots', () => {
    for (const src of ['{"a":1}', '[1,2,3]', '42', '"hi"', 'true', 'false', 'null']) {
      expect(parseDocument(src).kind).toBe('valid');
    }
  });

  it('accepts nested structures and unicode escapes', () => {
    expect(parseDocument('{"a":{"b":[1,{"c":"\\u00e9"}]}}').kind).toBe('valid');
  });

  it('treats duplicate keys as valid JSON (they are surfaced later, not rejected)', () => {
    expect(parseDocument('{"status":"open","status":"closed"}').kind).toBe('valid');
  });
});

describe('parseDocument — recognizable errors', () => {
  it('explains a trailing comma in an object', () => {
    const err = expectInvalid('{"a":1,}');
    expect(err.message).toMatch(/trailing comma/i);
    expect(err.code).toBe('PropertyNameExpected');
  });

  it('explains a trailing comma in an array', () => {
    expect(expectInvalid('[1,2,]').message).toMatch(/trailing comma/i);
  });

  it('explains a missing comma', () => {
    expect(expectInvalid('{"a":1 "b":2}').message).toMatch(/comma/i);
  });

  it('explains a missing colon', () => {
    expect(expectInvalid('{"a" 1}').message).toMatch(/colon/i);
  });

  it('explains an unterminated string', () => {
    expect(expectInvalid('{"a":"oops}').message).toMatch(/closing quote/i);
  });

  it('explains an invalid escape', () => {
    expect(expectInvalid('{"a":"x\\q"}').message).toMatch(/string escape/i);
  });

  it('explains a bad unicode escape', () => {
    expect(expectInvalid('{"a":"\\u12"}').message).toMatch(/unicode escape/i);
  });

  it('explains a missing closing brace and bracket', () => {
    expect(expectInvalid('{"a":1').message).toMatch(/closing brace/i);
    expect(expectInvalid('[1,2').message).toMatch(/closing bracket/i);
  });

  it('explains trailing content after the value', () => {
    expect(expectInvalid('{"a":1} extra').message).toMatch(/extra content/i);
  });

  it('explains single quotes and unquoted keys', () => {
    expect(expectInvalid("{'a':1}").message).toMatch(/double quotes/i);
    expect(expectInvalid('{a:1}').message).toMatch(/bare word/i);
  });

  it('explains comments (not allowed in standard JSON)', () => {
    expect(expectInvalid('{"a":1 // nope\n}').message).toMatch(/comments/i);
  });
});

describe('parseDocument — positions', () => {
  it('reports the 1-based line and column of the first error', () => {
    const err = expectInvalid('{\n  "a": 1,\n  "b" 2\n}');
    expect(err.position.line).toBe(3);
    expect(err.position.column).toBeGreaterThan(0);
    expect(err.context).toContain('^');
  });

  it('counts additional errors beyond the first', () => {
    const err = expectInvalid('{a:1}');
    expect(err.additionalErrors).toBeGreaterThanOrEqual(1);
  });

  it('aligns the caret under tabs by reusing the tab in the caret pad', () => {
    // A tab renders wider than one space, so the caret pad must contain the tab
    // too, or it would drift left of the real column.
    const err = expectInvalid('{\t"a" 1}');
    const caretLine = err.context.split('\n')[1] ?? '';
    expect(caretLine).toContain('\t');
    expect(caretLine.trimEnd().endsWith('^')).toBe(true);
  });
});

describe('LineIndex', () => {
  it('locates offsets across lines (LF)', () => {
    const idx = new LineIndex('abc\ndef\nghi');
    expect(idx.locate(0)).toMatchObject({ line: 1, column: 1 });
    expect(idx.locate(4)).toMatchObject({ line: 2, column: 1 });
    expect(idx.locate(6)).toMatchObject({ line: 2, column: 3 });
    expect(idx.locate(8)).toMatchObject({ line: 3, column: 1 });
  });

  it('treats CRLF as a single break', () => {
    const idx = new LineIndex('ab\r\ncd');
    expect(idx.locate(4)).toMatchObject({ line: 2, column: 1 });
    expect(idx.lineText(1)).toBe('ab');
    expect(idx.lineText(2)).toBe('cd');
  });

  it('clamps out-of-range offsets', () => {
    const idx = new LineIndex('abc');
    expect(idx.locate(999)).toMatchObject({ line: 1, column: 4 });
  });
});
