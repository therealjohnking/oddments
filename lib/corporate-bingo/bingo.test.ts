import { describe, expect, it } from 'vitest';
import { ALL_LINES, computeBingo } from './bingo';
import { freshMarks } from './generate';
import { CELL_COUNT, FREE_INDEX } from './types';

/** Marks with the given indices set (FREE is always marked via freshMarks). */
function marksFor(indices: number[]): boolean[] {
  const marks = freshMarks();
  for (const index of indices) marks[index] = true;
  return marks;
}

const ROWS = [
  [0, 1, 2, 3, 4],
  [5, 6, 7, 8, 9],
  [10, 11, 12, 13, 14],
  [15, 16, 17, 18, 19],
  [20, 21, 22, 23, 24],
];
const COLUMNS = [
  [0, 5, 10, 15, 20],
  [1, 6, 11, 16, 21],
  [2, 7, 12, 17, 22],
  [3, 8, 13, 18, 23],
  [4, 9, 14, 19, 24],
];
const MAIN_DIAGONAL = [0, 6, 12, 18, 24];
const ANTI_DIAGONAL = [4, 8, 12, 16, 20];

describe('ALL_LINES', () => {
  it('is the twelve standard bingo lines', () => {
    expect(ALL_LINES).toHaveLength(12);
    expect(ALL_LINES.filter((l) => l.kind === 'row')).toHaveLength(5);
    expect(ALL_LINES.filter((l) => l.kind === 'column')).toHaveLength(5);
    expect(ALL_LINES.filter((l) => l.kind === 'diagonal')).toHaveLength(2);
  });

  it('covers exactly the expected cell indices', () => {
    const byId = new Map(ALL_LINES.map((l) => [l.id, l.cells]));
    ROWS.forEach((cells, i) => expect(byId.get(`row-${i}`)).toEqual(cells));
    COLUMNS.forEach((cells, i) => expect(byId.get(`col-${i}`)).toEqual(cells));
    expect(byId.get('diag-main')).toEqual(MAIN_DIAGONAL);
    expect(byId.get('diag-anti')).toEqual(ANTI_DIAGONAL);
  });

  it('every line runs through the FREE center only when it geometrically should', () => {
    const throughCenter = ALL_LINES.filter((l) => l.cells.includes(FREE_INDEX)).map((l) => l.id);
    expect(new Set(throughCenter)).toEqual(new Set(['row-2', 'col-2', 'diag-main', 'diag-anti']));
  });
});

describe('computeBingo — single lines', () => {
  ROWS.forEach((cells, i) => {
    it(`detects row ${i + 1}`, () => {
      const bingo = computeBingo(marksFor(cells));
      expect(bingo.hasBingo).toBe(true);
      expect(bingo.completedLines.map((l) => l.id)).toContain(`row-${i}`);
    });
  });

  COLUMNS.forEach((cells, i) => {
    it(`detects column ${i + 1}`, () => {
      const bingo = computeBingo(marksFor(cells));
      expect(bingo.hasBingo).toBe(true);
      expect(bingo.completedLines.map((l) => l.id)).toContain(`col-${i}`);
    });
  });

  it('detects the main diagonal', () => {
    const bingo = computeBingo(marksFor(MAIN_DIAGONAL));
    expect(bingo.completedLines.map((l) => l.id)).toContain('diag-main');
  });

  it('detects the anti-diagonal', () => {
    const bingo = computeBingo(marksFor(ANTI_DIAGONAL));
    expect(bingo.completedLines.map((l) => l.id)).toContain('diag-anti');
  });
});

describe('computeBingo — the FREE center', () => {
  it('counts as marked, so a line through it needs only its other four squares', () => {
    // Mark the main diagonal *without* touching the center square.
    const withoutCenter = MAIN_DIAGONAL.filter((i) => i !== FREE_INDEX);
    const bingo = computeBingo(marksFor(withoutCenter));
    expect(bingo.completedLines.map((l) => l.id)).toContain('diag-main');
  });

  it('is never counted among the marked phrases', () => {
    const bingo = computeBingo(freshMarks());
    expect(bingo.markedPhrases).toBe(0);
    expect(bingo.remaining).toBe(24);
    expect(bingo.hasBingo).toBe(false);
  });

  it('forces the center marked even if stored as false', () => {
    const marks = freshMarks();
    marks[FREE_INDEX] = false;
    const withoutCenter = MAIN_DIAGONAL.filter((i) => i !== FREE_INDEX);
    for (const i of withoutCenter) marks[i] = true;
    const bingo = computeBingo(marks);
    expect(bingo.completedLines.map((l) => l.id)).toContain('diag-main');
  });
});

describe('computeBingo — counting', () => {
  it('excludes the FREE center from the marked-phrase count', () => {
    // Row 2 runs through the center; four of its squares are phrases.
    const bingo = computeBingo(marksFor(ROWS[2]!));
    expect(bingo.markedPhrases).toBe(4);
    expect(bingo.remaining).toBe(20);
  });
});

describe('computeBingo — near misses', () => {
  it('does not count four of five', () => {
    const bingo = computeBingo(marksFor([0, 1, 2, 3]));
    expect(bingo.hasBingo).toBe(false);
    expect(bingo.lineCount).toBe(0);
  });
});

describe('computeBingo — multiple simultaneous lines', () => {
  it('reports every completed line at once', () => {
    const bingo = computeBingo(marksFor([...ROWS[0]!, ...COLUMNS[0]!]));
    const ids = bingo.completedLines.map((l) => l.id);
    expect(ids).toContain('row-0');
    expect(ids).toContain('col-0');
    expect(bingo.lineCount).toBe(2);
  });

  it('marks each participating square, unioning overlaps', () => {
    const bingo = computeBingo(marksFor([...ROWS[0]!, ...COLUMNS[0]!]));
    // Union of row 0 and column 0.
    const expected = new Set([...ROWS[0]!, ...COLUMNS[0]!]);
    bingo.participating.forEach((flag, index) => {
      expect(flag).toBe(expected.has(index));
    });
  });
});

describe('computeBingo — full card', () => {
  it('recognizes all 24 phrases marked as every line complete', () => {
    const all = new Array<boolean>(CELL_COUNT).fill(true);
    const bingo = computeBingo(all);
    expect(bingo.isFullCard).toBe(true);
    expect(bingo.markedPhrases).toBe(24);
    expect(bingo.remaining).toBe(0);
    expect(bingo.lineCount).toBe(12);
  });
});

describe('computeBingo — unmarking', () => {
  it('removes a completed line when one of its squares is cleared', () => {
    const complete = marksFor(ROWS[0]!);
    expect(computeBingo(complete).lineCount).toBe(1);

    const cleared = complete.slice();
    cleared[2] = false;
    const after = computeBingo(cleared);
    expect(after.lineCount).toBe(0);
    expect(after.hasBingo).toBe(false);
  });
});

describe('computeBingo — robustness', () => {
  it('treats a short/oversized marks array safely', () => {
    expect(() => computeBingo([])).not.toThrow();
    expect(computeBingo([]).hasBingo).toBe(false);
    const oversized = new Array<boolean>(CELL_COUNT + 10).fill(true);
    expect(computeBingo(oversized).lineCount).toBe(12);
  });
});
