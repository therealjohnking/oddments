import { describe, expect, it } from 'vitest';
import {
  FLAG_ORDER,
  SUPPORTED_FLAGS,
  canonicalizeFlags,
  flagList,
  isFlagChar,
  isFlagSupported,
  toggleFlag,
} from './flags';

describe('flags', () => {
  it('detects support for the classic flags on any modern runtime', () => {
    for (const id of ['g', 'i', 'm', 's', 'u', 'y'] as const) {
      expect(isFlagSupported(id)).toBe(true);
    }
  });

  it('detects the modern d and v flags on this runtime (Node 26 / current browsers)', () => {
    // Feature-detected, not assumed — but the dev/test/target runtime supports both.
    expect(SUPPORTED_FLAGS.has('d')).toBe(true);
    expect(SUPPORTED_FLAGS.has('v')).toBe(true);
  });

  it('lists all eight flags in canonical order with metadata', () => {
    const list = flagList();
    expect(list.map((f) => f.id)).toEqual([...FLAG_ORDER]);
    for (const meta of list) {
      expect(meta.name).toBeTruthy();
      expect(meta.summary).toBeTruthy();
      expect(typeof meta.supported).toBe('boolean');
    }
  });

  it('canonicalizes flags: dedupes, drops unknowns, canonical order', () => {
    expect(canonicalizeFlags('ig')).toBe('gi');
    expect(canonicalizeFlags('gg')).toBe('g');
    expect(canonicalizeFlags('yusmigd')).toBe('dgimsuy');
    expect(canonicalizeFlags('vsuimgd')).toBe('dgimsuv');
    // Unknown characters are dropped; only the real flag letters survive.
    expect(canonicalizeFlags('xyz')).toBe('y');
    expect(canonicalizeFlags('gI!')).toBe('g');
  });

  it('recognizes flag characters', () => {
    expect(isFlagChar('g')).toBe(true);
    expect(isFlagChar('x')).toBe(false);
  });

  it('toggles a flag on and off, staying canonical', () => {
    expect(toggleFlag('g', 'i')).toBe('gi');
    expect(toggleFlag('gi', 'g')).toBe('i');
    expect(toggleFlag('i', 'g')).toBe('gi');
    expect(toggleFlag('', 'd')).toBe('d');
  });
});
