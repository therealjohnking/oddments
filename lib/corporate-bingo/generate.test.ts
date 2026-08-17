import { describe, expect, it } from 'vitest';
import { freshMarks, generateCard, sample, type Rng } from './generate';
import { CELL_COUNT, FREE_INDEX, PHRASE_COUNT } from './types';

/** A small, deterministic PRNG (mulberry32) so generation is repeatable in tests. */
function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECK = Array.from({ length: 40 }, (_, i) => `phrase-${i}`);

describe('sample', () => {
  it('draws the requested number of distinct items', () => {
    const drawn = sample(DECK, 24, mulberry32(1));
    expect(drawn).toHaveLength(24);
    expect(new Set(drawn).size).toBe(24);
  });

  it('draws only from the source', () => {
    const source = new Set(DECK);
    for (const item of sample(DECK, 24, mulberry32(2))) {
      expect(source.has(item)).toBe(true);
    }
  });

  it('never mutates the source array', () => {
    const original = DECK.slice();
    sample(DECK, 24, mulberry32(3));
    expect(DECK).toEqual(original);
  });

  it('returns a full shuffle when asked for more than are available', () => {
    const drawn = sample(['a', 'b', 'c'], 10, mulberry32(4));
    expect(drawn).toHaveLength(3);
    expect(new Set(drawn)).toEqual(new Set(['a', 'b', 'c']));
  });

  it('stays in range even for a pathological rng that returns ~1', () => {
    const almostOne: Rng = () => 0.9999999999;
    const drawn = sample(DECK, 24, almostOne);
    expect(drawn).toHaveLength(24);
    expect(drawn.every((item) => item !== undefined)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    expect(sample(DECK, 24, mulberry32(7))).toEqual(sample(DECK, 24, mulberry32(7)));
  });
});

describe('generateCard', () => {
  it('produces exactly 25 cells', () => {
    expect(generateCard(DECK, mulberry32(1))).toHaveLength(CELL_COUNT);
  });

  it('places the FREE space at the center and nowhere else', () => {
    const card = generateCard(DECK, mulberry32(2));
    card.forEach((cell, index) => {
      if (index === FREE_INDEX) expect(cell.kind).toBe('free');
      else expect(cell.kind).toBe('phrase');
    });
  });

  it('fills exactly 24 phrase squares', () => {
    const card = generateCard(DECK, mulberry32(3));
    const phrases = card.filter((cell) => cell.kind === 'phrase');
    expect(phrases).toHaveLength(PHRASE_COUNT);
  });

  it('never repeats a phrase on a card', () => {
    const card = generateCard(DECK, mulberry32(4));
    const texts = card.flatMap((cell) => (cell.kind === 'phrase' ? [cell.text] : []));
    expect(new Set(texts).size).toBe(PHRASE_COUNT);
  });

  it('draws every phrase from the source deck', () => {
    const source = new Set(DECK);
    const card = generateCard(DECK, mulberry32(5));
    for (const cell of card) {
      if (cell.kind === 'phrase') expect(source.has(cell.text)).toBe(true);
    }
  });

  it('does not mutate the source deck', () => {
    const original = DECK.slice();
    generateCard(DECK, mulberry32(6));
    expect(DECK).toEqual(original);
  });

  it('stays valid across many repeated generations', () => {
    for (let seed = 0; seed < 200; seed++) {
      const card = generateCard(DECK, mulberry32(seed));
      const texts = card.flatMap((cell) => (cell.kind === 'phrase' ? [cell.text] : []));
      expect(texts).toHaveLength(PHRASE_COUNT);
      expect(new Set(texts).size).toBe(PHRASE_COUNT);
      expect(card[FREE_INDEX]!.kind).toBe('free');
    }
  });

  it('normally differs substantially between two deals', () => {
    const a = generateCard(DECK, mulberry32(11));
    const b = generateCard(DECK, mulberry32(12));
    let samePosition = 0;
    for (let i = 0; i < CELL_COUNT; i++) {
      const ca = a[i]!;
      const cb = b[i]!;
      if (ca.kind === 'phrase' && cb.kind === 'phrase' && ca.text === cb.text) samePosition++;
    }
    // Two independent deals should share very few exact position/phrase pairings.
    expect(samePosition).toBeLessThan(6);
  });
});

describe('freshMarks', () => {
  it('marks only the FREE center', () => {
    const marks = freshMarks();
    expect(marks).toHaveLength(CELL_COUNT);
    expect(marks[FREE_INDEX]).toBe(true);
    expect(marks.filter((m) => m)).toHaveLength(1);
  });
});
