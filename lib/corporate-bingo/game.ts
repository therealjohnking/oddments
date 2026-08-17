/**
 * Game state transitions.
 *
 * Every way the game changes — dealing a card, toggling a square, clearing the
 * marks — is a pure function from one {@link GameState} to the next. The React
 * component only decides *when* to call these; the *what* lives here, where it is
 * unit-tested. All transitions return a new state object and never mutate their
 * input, so they compose cleanly with React's state updates.
 */

import { DEFAULT_PHRASES } from './default-phrases';
import { freshMarks, generateCard, type Rng } from './generate';
import { FREE_INDEX, type DeckMode, type GameState } from './types';

/** The phrases a game deals from, given its mode and saved custom deck. */
export function activeDeck(deckMode: DeckMode, customDeck: readonly string[]): readonly string[] {
  return deckMode === 'custom' ? customDeck : DEFAULT_PHRASES;
}

/** Deal a brand-new game from the default deck (used for a first-time visitor). */
export function dealDefaultGame(rng: Rng = Math.random): GameState {
  return {
    card: generateCard(DEFAULT_PHRASES, rng),
    marks: freshMarks(),
    deckMode: 'default',
    customDeck: [],
  };
}

/**
 * Deal a fresh card from the game's active deck, keeping the deck choice and the
 * saved custom phrases. Marks are cleared (a new card has no history).
 */
export function newCard(state: GameState, rng: Rng = Math.random): GameState {
  return {
    ...state,
    card: generateCard(activeDeck(state.deckMode, state.customDeck), rng),
    marks: freshMarks(),
  };
}

/**
 * Switch to a validated custom deck and deal a card from it. The phrases are
 * stored so the editor and future "new card" both remember them. This replaces
 * the whole game, so it takes no prior state.
 */
export function dealCustomGame(phrases: readonly string[], rng: Rng = Math.random): GameState {
  const customDeck = [...phrases];
  return {
    card: generateCard(customDeck, rng),
    marks: freshMarks(),
    deckMode: 'custom',
    customDeck,
  };
}

/**
 * Restore the built-in deck and deal from it. The saved custom phrases are kept
 * (only the *active* deck changes), so switching back is lossless.
 */
export function restoreDefaultDeck(state: GameState, rng: Rng = Math.random): GameState {
  return {
    ...state,
    card: generateCard(DEFAULT_PHRASES, rng),
    marks: freshMarks(),
    deckMode: 'default',
  };
}

/** Toggle a phrase square. The FREE center and out-of-range indices are no-ops. */
export function toggleMark(state: GameState, index: number): GameState {
  if (index === FREE_INDEX || index < 0 || index >= state.marks.length) return state;
  const marks = state.marks.slice();
  marks[index] = !marks[index];
  return { ...state, marks };
}

/** Clear every mark but keep the exact same card (never reshuffles). */
export function resetMarks(state: GameState): GameState {
  return { ...state, marks: freshMarks() };
}
