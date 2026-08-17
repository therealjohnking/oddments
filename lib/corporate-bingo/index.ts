/**
 * Public API for the Corporate Phrase Bingo engine — a local-first bingo card
 * for surviving meetings one cliché at a time.
 *
 * The engine is small and framework-agnostic. It normalizes a phrase deck, deals
 * a valid 5×5 card (24 phrases around a FREE center), decides which of the twelve
 * lines are complete, and validates whatever the browser had stored. The only
 * non-determinism is the card shuffle, and it takes an injectable random source,
 * so every part of this module is deterministic under test and nothing here ever
 * touches the network.
 */

export { DEFAULT_PHRASES } from './default-phrases';
export { normalizePhrase, normalizeDeck, validateDeck, defaultDeck, defaultDeckText } from './deck';
export { sample, generateCard, freshMarks, type Rng } from './generate';
export { ALL_LINES, computeBingo } from './bingo';
export {
  pluralize,
  formatLineList,
  summarizeProgress,
  bingoAnnouncement,
  cardSerial,
} from './format';
export {
  activeDeck,
  dealDefaultGame,
  newCard,
  dealCustomGame,
  restoreDefaultDeck,
  toggleMark,
  resetMarks,
} from './game';
export {
  STORAGE_KEY,
  STORAGE_VERSION,
  serializeGame,
  deserializeGame,
  loadGame,
  saveGame,
  clearGame,
} from './persistence';
export {
  CARD_DIMENSION,
  CELL_COUNT,
  FREE_INDEX,
  PHRASE_COUNT,
  MIN_DECK_SIZE,
  type DeckMode,
  type Cell,
  type Card,
  type GameState,
  type LineKind,
  type WinLine,
  type BingoState,
  type DeckValidation,
} from './types';
