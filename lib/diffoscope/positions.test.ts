import { describe, expect, it } from 'vitest';
import { LineIndex } from './positions';

const cp = (n: number) => String.fromCodePoint(n);

describe('LineIndex', () => {
  it('locates offsets on the first line (1-based)', () => {
    const index = new LineIndex('hello');
    expect(index.locate(0)).toEqual({ line: 1, column: 1 });
    expect(index.locate(4)).toEqual({ line: 1, column: 5 });
  });

  it('locates offsets after an LF', () => {
    const index = new LineIndex('abc\ndef');
    expect(index.locate(4)).toEqual({ line: 2, column: 1 }); // 'd'
    expect(index.locate(6)).toEqual({ line: 2, column: 3 }); // 'f'
  });

  it('handles CRLF as a single break', () => {
    const index = new LineIndex('a\r\nb');
    expect(index.locate(3)).toEqual({ line: 2, column: 1 }); // 'b' is at UTF-16 index 3
  });

  it('handles a lone CR', () => {
    const index = new LineIndex('a\rb');
    expect(index.locate(2)).toEqual({ line: 2, column: 1 });
  });

  it('counts columns in code points, not UTF-16 units, across an astral char', () => {
    const emoji = cp(0x1f600); // 2 UTF-16 units, 1 code point
    const index = new LineIndex(`${emoji}X`);
    // 'X' sits at UTF-16 offset 2 but is the 2nd code point → column 2.
    expect(index.locate(2)).toEqual({ line: 1, column: 2 });
  });
});
