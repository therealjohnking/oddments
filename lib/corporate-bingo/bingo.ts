/**
 * Win-line detection.
 *
 * A 5×5 card has twelve winnable lines: five rows, five columns, and two
 * diagonals. {@link computeBingo} is a pure function of the marks array — it
 * takes no card, because a completed line depends only on which squares are
 * marked (the FREE center is always marked, so a line through it needs its other
 * four squares). It reports every completed line at once: a card can hold several
 * simultaneously, and play continues past the first.
 */

import {
  CARD_DIMENSION,
  CELL_COUNT,
  FREE_INDEX,
  PHRASE_COUNT,
  type BingoState,
  type WinLine,
} from './types';

/** Build the twelve lines once, as `[row0…row4, col0…col4, mainDiag, antiDiag]`. */
function buildLines(): WinLine[] {
  const lines: WinLine[] = [];

  for (let row = 0; row < CARD_DIMENSION; row++) {
    const cells: number[] = [];
    for (let col = 0; col < CARD_DIMENSION; col++) cells.push(row * CARD_DIMENSION + col);
    lines.push({ id: `row-${row}`, kind: 'row', label: `Row ${row + 1}`, cells });
  }

  for (let col = 0; col < CARD_DIMENSION; col++) {
    const cells: number[] = [];
    for (let row = 0; row < CARD_DIMENSION; row++) cells.push(row * CARD_DIMENSION + col);
    lines.push({ id: `col-${col}`, kind: 'column', label: `Column ${col + 1}`, cells });
  }

  const main: number[] = [];
  const anti: number[] = [];
  for (let i = 0; i < CARD_DIMENSION; i++) {
    main.push(i * CARD_DIMENSION + i);
    anti.push(i * CARD_DIMENSION + (CARD_DIMENSION - 1 - i));
  }
  lines.push({ id: 'diag-main', kind: 'diagonal', label: 'Main diagonal', cells: main });
  lines.push({ id: 'diag-anti', kind: 'diagonal', label: 'Anti-diagonal', cells: anti });

  return lines;
}

/** The twelve winnable lines, in a stable order (rows, columns, then diagonals). */
export const ALL_LINES: readonly WinLine[] = buildLines();

/** True when every square in `line` is marked. */
function isLineComplete(line: WinLine, marks: readonly boolean[]): boolean {
  return line.cells.every((index) => marks[index] === true);
}

/**
 * Derive the bingo situation from a marks array. Robust to a marks array of the
 * wrong length: any missing entry reads as unmarked, and the FREE center is
 * always counted as marked regardless of what was stored.
 */
export function computeBingo(marks: readonly boolean[]): BingoState {
  // Work from a normalized view so a corrupt/short array can never crash us and
  // FREE is authoritative rather than trusting the stored value.
  const effective: boolean[] = new Array<boolean>(CELL_COUNT);
  for (let i = 0; i < CELL_COUNT; i++) effective[i] = marks[i] === true;
  effective[FREE_INDEX] = true;

  const completedLines = ALL_LINES.filter((line) => isLineComplete(line, effective));

  const participating = new Array<boolean>(CELL_COUNT).fill(false);
  for (const line of completedLines) {
    for (const index of line.cells) participating[index] = true;
  }

  let markedPhrases = 0;
  for (let i = 0; i < CELL_COUNT; i++) {
    if (i !== FREE_INDEX && effective[i]) markedPhrases++;
  }

  return {
    completedLines,
    participating,
    lineCount: completedLines.length,
    hasBingo: completedLines.length > 0,
    markedPhrases,
    totalPhrases: PHRASE_COUNT,
    remaining: PHRASE_COUNT - markedPhrases,
    isFullCard: markedPhrases === PHRASE_COUNT,
  };
}
