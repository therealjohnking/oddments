/**
 * Card generation.
 *
 * Dealing a card is the one place Corporate Phrase Bingo is non-deterministic,
 * so the randomness is a parameter, not a hidden dependency. {@link sample} and
 * {@link generateCard} take a `Rng` (defaulting to `Math.random`); the app uses
 * the browser's generator, and tests pass a seeded one to assert exact layouts.
 * Nothing here touches the network or any global state, and the source deck is
 * never mutated.
 */

import { CELL_COUNT, FREE_INDEX, PHRASE_COUNT, type Card, type Cell } from './types';

/** A source of randomness in `[0, 1)`, shaped like `Math.random`. */
export type Rng = () => number;

/**
 * Draw `count` distinct items from `items`, uniformly and without replacement,
 * via a partial Fisher–Yates shuffle over a copy. The input is never mutated.
 * Requesting more than are available returns a full shuffle (all of them).
 */
export function sample<T>(items: readonly T[], count: number, rng: Rng = Math.random): T[] {
  const pool = items.slice();
  const take = Math.min(count, pool.length);
  // Fisher–Yates, but only far enough to fix the first `take` positions.
  for (let i = 0; i < take; i++) {
    // j ∈ [i, pool.length); the clamp guards against a pathological rng that
    // returns exactly 1 (or a hair over), which would otherwise index off the end.
    const j = i + Math.min(pool.length - 1 - i, Math.floor(rng() * (pool.length - i)));
    const a = pool[i]!;
    const b = pool[j]!;
    pool[i] = b;
    pool[j] = a;
  }
  return pool.slice(0, take);
}

/**
 * Deal a 5×5 card from a deck: 24 distinct phrases around a FREE center. The
 * deck is assumed already validated (≥ 24 unique phrases); a short deck simply
 * yields as many phrase squares as it can, but callers should validate first.
 */
export function generateCard(deck: readonly string[], rng: Rng = Math.random): Card {
  const chosen = sample(deck, PHRASE_COUNT, rng);
  const cells: Cell[] = [];
  let next = 0;
  for (let index = 0; index < CELL_COUNT; index++) {
    if (index === FREE_INDEX) {
      cells.push({ kind: 'free' });
    } else {
      const text = chosen[next++];
      // Only reachable with an under-sized deck; a validated deck always fills.
      cells.push(text === undefined ? { kind: 'free' } : { kind: 'phrase', text });
    }
  }
  return cells;
}

/** A fresh marks array for a new card: everything clear except the FREE center. */
export function freshMarks(): boolean[] {
  const marks = new Array<boolean>(CELL_COUNT).fill(false);
  marks[FREE_INDEX] = true;
  return marks;
}
