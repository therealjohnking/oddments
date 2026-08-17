import { describe, expect, it } from 'vitest';
import { DEFAULT_PHRASES } from './default-phrases';
import { defaultDeck, defaultDeckText, normalizeDeck, normalizePhrase, validateDeck } from './deck';
import { MIN_DECK_SIZE } from './types';

describe('normalizePhrase', () => {
  it('trims surrounding whitespace', () => {
    expect(normalizePhrase('  circle back  ')).toBe('circle back');
  });

  it('collapses internal whitespace runs', () => {
    expect(normalizePhrase('circle\t  back')).toBe('circle back');
    expect(normalizePhrase('run   it  up the  flagpole')).toBe('run it up the flagpole');
  });

  it('reduces an all-whitespace string to empty', () => {
    expect(normalizePhrase('   \t  ')).toBe('');
  });
});

describe('normalizeDeck', () => {
  it('splits on any line-ending style and ignores blank lines', () => {
    expect(normalizeDeck('a\nb\r\nc\rd\n\n  \n')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trims each line', () => {
    expect(normalizeDeck('  synergy  \n\tleverage\t')).toEqual(['synergy', 'leverage']);
  });

  it('removes duplicates case- and whitespace-insensitively, keeping the first spelling', () => {
    expect(normalizeDeck('Circle Back\ncircle back\nCIRCLE   BACK\nsynergy')).toEqual([
      'Circle Back',
      'synergy',
    ]);
  });

  it('folds case locale-independently (accented duplicates collapse deterministically)', () => {
    // Uses Unicode default case folding (toLowerCase), not locale rules, so the
    // result never depends on the user's browser/OS locale.
    expect(normalizeDeck('Café\nCAFÉ\ncafé')).toEqual(['Café']);
  });

  it('preserves input order', () => {
    expect(normalizeDeck('c\na\nb')).toEqual(['c', 'a', 'b']);
  });
});

describe('validateDeck', () => {
  it('accepts a deck with exactly the minimum number of unique phrases', () => {
    const raw = Array.from({ length: MIN_DECK_SIZE }, (_, i) => `phrase ${i}`).join('\n');
    const result = validateDeck(raw);
    expect(result.ok).toBe(true);
    expect(result.error).toBeNull();
    expect(result.uniqueCount).toBe(MIN_DECK_SIZE);
    expect(result.phrases).toHaveLength(MIN_DECK_SIZE);
  });

  it('rejects a deck with too few unique phrases and explains the minimum', () => {
    const raw = Array.from({ length: 10 }, (_, i) => `phrase ${i}`).join('\n');
    const result = validateDeck(raw);
    expect(result.ok).toBe(false);
    expect(result.uniqueCount).toBe(10);
    expect(result.error).toContain(String(MIN_DECK_SIZE));
    // Still surfaces the usable subset rather than discarding the user's work.
    expect(result.phrases).toHaveLength(10);
  });

  it('counts duplicates toward rawCount but not uniqueCount, and mentions them', () => {
    const lines = Array.from({ length: 20 }, (_, i) => `phrase ${i}`);
    // Repeat several so there are enough raw lines but too few unique ones.
    const raw = [...lines, 'phrase 0', 'phrase 1', 'phrase 2', 'phrase 3', 'phrase 4'].join('\n');
    const result = validateDeck(raw);
    expect(result.rawCount).toBe(25);
    expect(result.uniqueCount).toBe(20);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/duplicate/i);
  });

  it('treats an empty deck as invalid without throwing', () => {
    const result = validateDeck('   \n\n');
    expect(result.ok).toBe(false);
    expect(result.uniqueCount).toBe(0);
    expect(result.rawCount).toBe(0);
  });
});

describe('the built-in default deck', () => {
  it('has enough unique phrases to deal a card, comfortably', () => {
    const result = defaultDeck();
    expect(result.ok).toBe(true);
    expect(result.uniqueCount).toBeGreaterThanOrEqual(50);
  });

  it('contains no duplicates (case-insensitively)', () => {
    const keys = DEFAULT_PHRASES.map((p) => p.toLowerCase());
    expect(new Set(keys).size).toBe(DEFAULT_PHRASES.length);
  });

  it('is already normalized (no leading/trailing or doubled whitespace)', () => {
    for (const phrase of DEFAULT_PHRASES) {
      expect(normalizePhrase(phrase)).toBe(phrase);
    }
  });

  it('round-trips through its editor text form', () => {
    expect(normalizeDeck(defaultDeckText())).toEqual([...DEFAULT_PHRASES]);
  });
});
