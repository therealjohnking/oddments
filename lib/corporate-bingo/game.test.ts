import { describe, expect, it } from 'vitest';
import { DEFAULT_PHRASES } from './default-phrases';
import {
  activeDeck,
  dealDefaultGame,
  newCard,
  resetMarks,
  toggleMark,
  dealCustomGame,
  restoreDefaultDeck,
} from './game';
import { type Rng } from './generate';
import { CELL_COUNT, FREE_INDEX, PHRASE_COUNT } from './types';

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

const CUSTOM = Array.from({ length: PHRASE_COUNT }, (_, i) => `custom-${i}`);

function phraseSet(card: { kind: string; text?: string }[]): Set<string> {
  return new Set(card.flatMap((cell) => (cell.kind === 'phrase' ? [cell.text!] : [])));
}

describe('activeDeck', () => {
  it('returns the default phrases in default mode', () => {
    expect(activeDeck('default', ['x'])).toBe(DEFAULT_PHRASES);
  });
  it('returns the custom deck in custom mode', () => {
    const deck = ['x', 'y'];
    expect(activeDeck('custom', deck)).toBe(deck);
  });
});

describe('dealDefaultGame', () => {
  it('deals a valid default game with a clean slate', () => {
    const game = dealDefaultGame(mulberry32(1));
    expect(game.deckMode).toBe('default');
    expect(game.customDeck).toEqual([]);
    expect(game.card).toHaveLength(CELL_COUNT);
    expect(game.marks.filter((m) => m)).toEqual([true]); // FREE only
    expect(phraseSet(game.card).size).toBe(PHRASE_COUNT);
  });
});

describe('newCard', () => {
  it('keeps the deck choice and clears marks', () => {
    const game = dealDefaultGame(mulberry32(2));
    game.marks[0] = true;
    const next = newCard(game, mulberry32(3));
    expect(next.deckMode).toBe('default');
    expect(next.marks.filter((m) => m)).toEqual([true]);
  });

  it('deals from the custom deck when in custom mode', () => {
    const game = dealCustomGame(CUSTOM, mulberry32(4));
    const next = newCard(game, mulberry32(5));
    expect(phraseSet(next.card)).toEqual(new Set(CUSTOM));
  });

  it('does not mutate the previous game', () => {
    const game = dealDefaultGame(mulberry32(6));
    const before = JSON.stringify(game);
    newCard(game, mulberry32(7));
    expect(JSON.stringify(game)).toBe(before);
  });
});

describe('dealCustomGame', () => {
  it('switches to the custom deck and deals from it', () => {
    const game = dealCustomGame(CUSTOM, mulberry32(8));
    expect(game.deckMode).toBe('custom');
    expect(game.customDeck).toEqual(CUSTOM);
    expect(phraseSet(game.card)).toEqual(new Set(CUSTOM));
    expect(game.marks.filter((m) => m)).toEqual([true]);
  });
});

describe('restoreDefaultDeck', () => {
  it('restores the default deck but keeps the saved custom phrases', () => {
    const custom = dealCustomGame(CUSTOM, mulberry32(9));
    const restored = restoreDefaultDeck(custom, mulberry32(10));
    expect(restored.deckMode).toBe('default');
    expect(restored.customDeck).toEqual(CUSTOM); // preserved for a lossless switch back
    const source = new Set(DEFAULT_PHRASES);
    for (const text of phraseSet(restored.card)) expect(source.has(text)).toBe(true);
  });
});

describe('toggleMark', () => {
  it('toggles a phrase square on and off', () => {
    const game = dealDefaultGame(mulberry32(11));
    const on = toggleMark(game, 0);
    expect(on.marks[0]).toBe(true);
    const off = toggleMark(on, 0);
    expect(off.marks[0]).toBe(false);
  });

  it('is a no-op on the FREE center (returns the same state)', () => {
    const game = dealDefaultGame(mulberry32(12));
    expect(toggleMark(game, FREE_INDEX)).toBe(game);
  });

  it('is a no-op for out-of-range indices', () => {
    const game = dealDefaultGame(mulberry32(13));
    expect(toggleMark(game, -1)).toBe(game);
    expect(toggleMark(game, CELL_COUNT)).toBe(game);
  });

  it('does not mutate the previous marks array', () => {
    const game = dealDefaultGame(mulberry32(14));
    toggleMark(game, 3);
    expect(game.marks[3]).toBe(false);
  });
});

describe('resetMarks', () => {
  it('clears marks but keeps the exact same card (no reshuffle)', () => {
    const game = dealDefaultGame(mulberry32(15));
    const played = toggleMark(toggleMark(game, 1), 2);
    const reset = resetMarks(played);
    expect(reset.card).toBe(played.card); // same reference — the card is untouched
    expect(reset.marks.filter((m) => m)).toEqual([true]);
  });
});
