/**
 * Shared types for Corporate Phrase Bingo — a local-first bingo card for
 * surviving meetings one cliché at a time.
 *
 * The engine's job is small and self-contained: normalize a phrase deck, deal a
 * valid 5×5 card, decide which bingo lines are complete, and validate what was
 * stored in the browser. There is no network, no account, and no shared state —
 * the only non-determinism is the card shuffle, and even that takes an injectable
 * random source so generation is fully testable.
 *
 * Grid geometry is fixed at 5×5. Cells are indexed row-major: `index = row * 5 +
 * column`, so the center square (row 2, column 2) is always index 12 — the FREE
 * space, which counts as marked but is never a phrase and is never toggled.
 */

/** The card is five squares to a side. */
export const CARD_DIMENSION = 5;
/** Twenty-five squares in total. */
export const CELL_COUNT = CARD_DIMENSION * CARD_DIMENSION;
/** The center square (row 2, column 2) is the FREE space. */
export const FREE_INDEX = 12;
/** Twenty-four phrase squares surround the FREE center. */
export const PHRASE_COUNT = CELL_COUNT - 1;
/** A deck must contain at least this many unique phrases to fill a card. */
export const MIN_DECK_SIZE = PHRASE_COUNT;

/** Which deck a game is currently playing from. */
export type DeckMode = 'default' | 'custom';

/**
 * One square on the card. The center is always the FREE space; every other
 * square carries a single phrase. Kept as a discriminated union (rather than,
 * say, `string | null`) so persistence can validate a stored cell precisely and
 * the UI never has to special-case an index to know what it is rendering.
 */
export type Cell = { readonly kind: 'free' } | { readonly kind: 'phrase'; readonly text: string };

/** A dealt card: exactly 25 cells, row-major, with FREE at {@link FREE_INDEX}. */
export type Card = Cell[];

/** The full, persistable state of one game. */
export interface GameState {
  /** The dealt card (25 cells). */
  card: Card;
  /** Marked squares, parallel to `card`; the FREE index is always `true`. */
  marks: boolean[];
  /** Whether the active deck is the built-in default or the user's custom list. */
  deckMode: DeckMode;
  /**
   * The user's saved custom phrases, retained even while playing the default
   * deck so the editor can repopulate them. Empty when none has been saved.
   */
  customDeck: string[];
}

/** A bingo line runs across a row, down a column, or along a diagonal. */
export type LineKind = 'row' | 'column' | 'diagonal';

/** One of the twelve winnable lines and the five cell indices it covers. */
export interface WinLine {
  /** Stable id, e.g. `row-0`, `col-3`, `diag-main`. */
  id: string;
  kind: LineKind;
  /** Human label for stats and announcements, e.g. "Row 3", "Main diagonal". */
  label: string;
  /** The five cell indices this line covers, in reading order. */
  cells: number[];
}

/** The derived bingo situation for a set of marks. Pure function of the marks. */
export interface BingoState {
  /** Every line whose five squares are all marked (FREE counts as marked). */
  completedLines: WinLine[];
  /** Parallel to the card: `true` where a square is part of a completed line. */
  participating: boolean[];
  /** Number of completed lines (a card can have several at once). */
  lineCount: number;
  /** True once at least one line is complete. */
  hasBingo: boolean;
  /** Marked phrase squares (excludes the FREE center). */
  markedPhrases: number;
  /** Total phrase squares on a card (always {@link PHRASE_COUNT}). */
  totalPhrases: number;
  /** Unmarked phrase squares remaining. */
  remaining: number;
  /** True when every one of the 24 phrase squares is marked. */
  isFullCard: boolean;
}

/** The result of normalizing and validating a candidate phrase deck. */
export interface DeckValidation {
  /** True when the deck has enough unique phrases to deal a card. */
  ok: boolean;
  /** The normalized, de-duplicated phrases (the usable subset, even when short). */
  phrases: string[];
  /** How many unique phrases survived normalization. */
  uniqueCount: number;
  /** How many non-empty phrases were present before de-duplication. */
  rawCount: number;
  /** A plain-language reason when `ok` is false; `null` when valid. */
  error: string | null;
}
