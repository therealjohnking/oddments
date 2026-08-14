import { describe, expect, it } from 'vitest';
import {
  decodePointerToken,
  encodePointerToken,
  fromJsonPointer,
  toJsPath,
  toJsonPointer,
} from './paths';

describe('JSON Pointer (RFC 6901)', () => {
  it('encodes the root as the empty string', () => {
    expect(toJsonPointer([])).toBe('');
  });

  it('builds pointers for object and array paths', () => {
    expect(toJsonPointer(['orders', 3, 'customer', 'name'])).toBe('/orders/3/customer/name');
  });

  it('escapes ~ as ~0 and / as ~1, in that order', () => {
    expect(encodePointerToken('a/b')).toBe('a~1b');
    expect(encodePointerToken('a~b')).toBe('a~0b');
    // A literal "~1" must not round-trip into a "/".
    expect(encodePointerToken('~1')).toBe('~01');
    expect(toJsonPointer(['a/b', 'c~d'])).toBe('/a~1b/c~0d');
  });

  it('round-trips awkward keys through encode/decode', () => {
    for (const key of ['a/b', 'a~b', '~1', '/', '~', '', 'plain', 'a~1/b']) {
      expect(decodePointerToken(encodePointerToken(key))).toBe(key);
    }
  });

  it('parses pointers back into decoded segments', () => {
    expect(fromJsonPointer('')).toEqual([]);
    expect(fromJsonPointer('/orders/3/customer/name')).toEqual(['orders', '3', 'customer', 'name']);
    expect(fromJsonPointer('/a~1b/c~0d')).toEqual(['a/b', 'c~d']);
  });
});

describe('JavaScript-style path', () => {
  it('names the root', () => {
    expect(toJsPath([])).toBe('$');
  });

  it('uses dot notation for identifier keys and brackets for indexes', () => {
    expect(toJsPath(['orders', 3, 'customer', 'name'])).toBe('orders[3].customer.name');
  });

  it('uses bracket notation for keys that are not valid identifiers', () => {
    expect(toJsPath(['a-b'])).toBe('["a-b"]');
    expect(toJsPath(['weird key'])).toBe('["weird key"]');
    expect(toJsPath(['123'])).toBe('["123"]');
    expect(toJsPath([''])).toBe('[""]');
    expect(toJsPath(['a', 'b-c', 'd'])).toBe('a["b-c"].d');
  });

  it('quotes keys containing quotes or slashes correctly', () => {
    expect(toJsPath(['a"b'])).toBe('["a\\"b"]');
    expect(toJsPath(['a/b'])).toBe('["a/b"]');
  });

  it('prefixes the root label when the path leads with an index', () => {
    expect(toJsPath([0, 'name'])).toBe('$[0].name');
    expect(toJsPath([2])).toBe('$[2]');
  });

  it('accepts identifier keys with $ and _', () => {
    expect(toJsPath(['_private', '$ref'])).toBe('_private.$ref');
  });

  it('disambiguates a top-level key equal to the root label', () => {
    // A property literally named "$" must not collide with the bare root "$".
    expect(toJsPath(['$'])).toBe('$["$"]');
    expect(toJsPath([])).toBe('$');
    expect(toJsPath(['a', '$'])).toBe('a["$"]');
  });
});
