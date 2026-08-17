import { describe, expect, it } from 'vitest';
import { deserializeGame, serializeGame, STORAGE_VERSION } from './persistence';
import { CELL_COUNT, FREE_INDEX, type Cell, type Card, type GameState } from './types';

function validCard(): Card {
  const cells: Cell[] = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    cells.push(i === FREE_INDEX ? { kind: 'free' } : { kind: 'phrase', text: `phrase ${i}` });
  }
  return cells;
}

function validGame(overrides: Partial<GameState> = {}): GameState {
  const marks = new Array<boolean>(CELL_COUNT).fill(false);
  marks[FREE_INDEX] = true;
  return { card: validCard(), marks, deckMode: 'default', customDeck: [], ...overrides };
}

/** Serialize a valid game, then tamper with the parsed object before re-stringifying. */
function tampered(mutate: (blob: Record<string, unknown>) => void): string {
  const blob = JSON.parse(serializeGame(validGame())) as Record<string, unknown>;
  mutate(blob);
  return JSON.stringify(blob);
}

describe('serialize / deserialize round trip', () => {
  it('restores a valid game exactly', () => {
    const game = validGame();
    const restored = deserializeGame(serializeGame(game));
    expect(restored).toEqual(game);
  });

  it('retains marked squares', () => {
    const game = validGame();
    game.marks[0] = true;
    game.marks[7] = true;
    const restored = deserializeGame(serializeGame(game));
    expect(restored?.marks[0]).toBe(true);
    expect(restored?.marks[7]).toBe(true);
    expect(restored?.marks[FREE_INDEX]).toBe(true);
  });

  it('retains the deck mode and the custom deck', () => {
    const game = validGame({ deckMode: 'custom', customDeck: ['alpha', 'beta', 'gamma'] });
    const restored = deserializeGame(serializeGame(game));
    expect(restored?.deckMode).toBe('custom');
    expect(restored?.customDeck).toEqual(['alpha', 'beta', 'gamma']);
  });
});

describe('rejecting unusable blobs', () => {
  it('returns null for missing or empty input', () => {
    expect(deserializeGame(null)).toBeNull();
    expect(deserializeGame('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(deserializeGame('{not json')).toBeNull();
    expect(deserializeGame('[1,2,3')).toBeNull();
  });

  it('returns null for non-object JSON', () => {
    expect(deserializeGame('null')).toBeNull();
    expect(deserializeGame('42')).toBeNull();
    expect(deserializeGame('"hello"')).toBeNull();
  });

  it('returns null for an incompatible schema version', () => {
    expect(deserializeGame(tampered((b) => (b.version = STORAGE_VERSION + 1)))).toBeNull();
    expect(deserializeGame(tampered((b) => delete b.version))).toBeNull();
  });
});

describe('rejecting a structurally invalid card', () => {
  it('rejects a card of the wrong length', () => {
    expect(
      deserializeGame(tampered((b) => (b.card = (b.card as unknown[]).slice(0, 24)))),
    ).toBeNull();
    expect(deserializeGame(tampered((b) => (b.card = 'not a card')))).toBeNull();
  });

  it('rejects a phrase where the FREE center should be', () => {
    expect(
      deserializeGame(
        tampered((b) => {
          (b.card as Cell[])[FREE_INDEX] = { kind: 'phrase', text: 'oops' };
        }),
      ),
    ).toBeNull();
  });

  it('rejects a FREE cell anywhere but the center', () => {
    expect(
      deserializeGame(
        tampered((b) => {
          (b.card as Cell[])[0] = { kind: 'free' };
        }),
      ),
    ).toBeNull();
  });

  it('rejects a phrase cell with an empty or non-string text', () => {
    expect(
      deserializeGame(
        tampered((b) => {
          (b.card as Cell[])[0] = { kind: 'phrase', text: '   ' };
        }),
      ),
    ).toBeNull();
    expect(
      deserializeGame(
        tampered((b) => {
          (b.card as { kind: string; text?: unknown }[])[0] = { kind: 'phrase', text: 5 };
        }),
      ),
    ).toBeNull();
  });
});

describe('recovering a valid card with lesser corruption', () => {
  it('resets malformed marks to a fresh set rather than discarding the card', () => {
    const restored = deserializeGame(tampered((b) => (b.marks = 'nope')));
    expect(restored).not.toBeNull();
    expect(restored?.marks).toHaveLength(CELL_COUNT);
    expect(restored?.marks.filter((m) => m)).toEqual([true]); // only FREE
    expect(restored?.marks[FREE_INDEX]).toBe(true);
  });

  it('coerces a wrong-length marks array and forces the FREE center marked', () => {
    const restored = deserializeGame(
      tampered((b) => {
        b.marks = [true]; // too short, and center left implicitly unmarked
      }),
    );
    expect(restored?.marks[0]).toBe(true);
    expect(restored?.marks[FREE_INDEX]).toBe(true);
    expect(restored?.marks).toHaveLength(CELL_COUNT);
  });

  it('falls back to the default deck mode for an unknown value', () => {
    expect(deserializeGame(tampered((b) => (b.deckMode = 'weird')))?.deckMode).toBe('default');
    expect(deserializeGame(tampered((b) => delete b.deckMode))?.deckMode).toBe('default');
  });

  it('cleans a corrupt custom deck (drops non-strings, trims, de-duplicates)', () => {
    const restored = deserializeGame(
      tampered((b) => {
        b.customDeck = ['alpha', 2, 'alpha', '  beta  ', null];
      }),
    );
    expect(restored?.customDeck).toEqual(['alpha', 'beta']);
  });

  it('defaults a non-array custom deck to empty', () => {
    expect(deserializeGame(tampered((b) => (b.customDeck = 'nope')))?.customDeck).toEqual([]);
  });
});
