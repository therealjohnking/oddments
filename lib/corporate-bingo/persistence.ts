/**
 * Browser-local persistence.
 *
 * One game lives under one localStorage key. The contract is deliberately
 * defensive: anything read back is treated as untrusted. A stored blob is
 * accepted only when it parses, carries the current schema version, and contains
 * a structurally valid card; otherwise {@link deserializeGame} returns `null` and
 * the app deals a fresh card instead of crashing. Marks, deck mode, and the saved
 * custom phrases are coerced leniently — a valid card is worth keeping even if a
 * lesser field got mangled — so a future schema change can always recover by
 * discarding what it cannot understand.
 *
 * The pure `serializeGame` / `deserializeGame` pair carries all the logic and is
 * unit-tested directly; the `loadGame` / `saveGame` / `clearGame` wrappers only
 * add the localStorage round-trip and swallow its errors (private mode, quota).
 */

import { normalizeDeck } from './deck';
import { freshMarks } from './generate';
import {
  CELL_COUNT,
  FREE_INDEX,
  type Card,
  type Cell,
  type DeckMode,
  type GameState,
} from './types';

/** The single key all game state is stored under. */
export const STORAGE_KEY = 'oddments-corporate-bingo';
/** Bump when the persisted shape changes incompatibly; older blobs are discarded. */
export const STORAGE_VERSION = 1;

/** Serialize a game to a versioned JSON string for storage. */
export function serializeGame(state: GameState): string {
  return JSON.stringify({
    version: STORAGE_VERSION,
    card: state.card,
    marks: state.marks,
    deckMode: state.deckMode,
    customDeck: state.customDeck,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Rebuild a single valid cell, or `null` if the stored value is unusable. */
function parseCell(value: unknown, expectFree: boolean): Cell | null {
  if (!isRecord(value)) return null;
  if (expectFree) return value.kind === 'free' ? { kind: 'free' } : null;
  if (value.kind !== 'phrase') return null;
  const text = value.text;
  if (typeof text !== 'string' || text.trim() === '') return null;
  return { kind: 'phrase', text };
}

/** Validate and rebuild a stored card: 25 cells, phrases around a FREE center. */
function parseCard(value: unknown): Card | null {
  if (!Array.isArray(value) || value.length !== CELL_COUNT) return null;
  const cells: Cell[] = [];
  for (let index = 0; index < CELL_COUNT; index++) {
    const cell = parseCell(value[index], index === FREE_INDEX);
    if (cell === null) return null;
    cells.push(cell);
  }
  return cells;
}

/** Coerce stored marks into a clean 25-length array with FREE forced marked. */
function parseMarks(value: unknown): boolean[] {
  const marks = freshMarks();
  if (Array.isArray(value)) {
    for (let i = 0; i < CELL_COUNT; i++) marks[i] = value[i] === true;
  }
  marks[FREE_INDEX] = true;
  return marks;
}

function parseDeckMode(value: unknown): DeckMode {
  return value === 'custom' ? 'custom' : 'default';
}

/** Coerce a stored custom deck back into a clean phrase list (never throws). */
function parseCustomDeck(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const text = value.filter((entry): entry is string => typeof entry === 'string').join('\n');
  return normalizeDeck(text);
}

/**
 * Parse a stored blob into a game, or `null` when it is missing, malformed,
 * from an incompatible version, or carries a structurally invalid card. A valid
 * card with lesser corruption (marks/mode/custom deck) is recovered rather than
 * discarded.
 */
export function deserializeGame(raw: string | null): GameState | null {
  if (raw === null || raw === '') return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.version !== STORAGE_VERSION) return null;

  const card = parseCard(parsed.card);
  if (card === null) return null;

  return {
    card,
    marks: parseMarks(parsed.marks),
    deckMode: parseDeckMode(parsed.deckMode),
    customDeck: parseCustomDeck(parsed.customDeck),
  };
}

/** Read the saved game from localStorage, or `null` if none/unusable/blocked. */
export function loadGame(): GameState | null {
  try {
    return deserializeGame(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Persist the game to localStorage; failures (quota, private mode) are ignored. */
export function saveGame(state: GameState): void {
  try {
    localStorage.setItem(STORAGE_KEY, serializeGame(state));
  } catch {
    // Nothing we can do — the game simply won't be remembered this session.
  }
}

/** Remove any saved game from localStorage. */
export function clearGame(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore — storage may be unavailable.
  }
}
