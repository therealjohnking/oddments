import { describe, expect, it } from 'vitest';
import { ALL_LINES, computeBingo } from './bingo';
import {
  bingoAnnouncement,
  cardSerial,
  formatLineList,
  pluralize,
  summarizeProgress,
} from './format';
import { freshMarks, generateCard } from './generate';
import { CELL_COUNT, type WinLine } from './types';

function line(id: string): WinLine {
  const found = ALL_LINES.find((l) => l.id === id);
  if (!found) throw new Error(`no line ${id}`);
  return found;
}

function marksFor(indices: number[]): boolean[] {
  const marks = freshMarks();
  for (const i of indices) marks[i] = true;
  return marks;
}

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'line')).toBe('1 line');
  });
  it('uses the plural otherwise', () => {
    expect(pluralize(0, 'line')).toBe('0 lines');
    expect(pluralize(3, 'phrase')).toBe('3 phrases');
  });
  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'index', 'indices')).toBe('2 indices');
  });
});

describe('formatLineList', () => {
  it('returns an empty string for no lines', () => {
    expect(formatLineList([])).toBe('');
  });
  it('names a single line', () => {
    expect(formatLineList([line('row-0')])).toBe('Row 1');
  });
  it('joins two with "and"', () => {
    expect(formatLineList([line('row-0'), line('col-1')])).toBe('Row 1 and Column 2');
  });
  it('uses an Oxford comma for three or more and reads diagonals naturally', () => {
    expect(formatLineList([line('row-0'), line('col-1'), line('diag-main')])).toBe(
      'Row 1, Column 2, and the main diagonal',
    );
  });
});

describe('summarizeProgress', () => {
  it('describes plain progress before any bingo', () => {
    expect(summarizeProgress(computeBingo(marksFor([0, 1, 2])))).toBe(
      '3 phrases marked · 21 phrases to go.',
    );
  });
  it('describes completed lines once there is a bingo', () => {
    // Row 0 is five phrase squares (it does not pass through the FREE center).
    expect(summarizeProgress(computeBingo(marksFor([0, 1, 2, 3, 4])))).toBe(
      '1 line complete · 19 phrases to go.',
    );
  });
  it('recognizes a full card', () => {
    expect(summarizeProgress(computeBingo(new Array<boolean>(CELL_COUNT).fill(true)))).toBe(
      'Full card — every phrase heard.',
    );
  });
});

describe('cardSerial', () => {
  const deck = Array.from({ length: 40 }, (_, i) => `phrase-${i}`);
  const rng = () => 0.42; // stable, so generateCard is deterministic here

  it('is a stable 4-character code for a given card', () => {
    const card = generateCard(deck, rng);
    const serial = cardSerial(card);
    expect(serial).toMatch(/^[0-9A-Z]{4}$/);
    expect(cardSerial(card)).toBe(serial); // deterministic
  });

  it('generally differs between different cards', () => {
    const a = cardSerial(generateCard(deck, () => 0.1));
    const b = cardSerial(generateCard(deck, () => 0.9));
    expect(a).not.toBe(b);
  });
});

describe('bingoAnnouncement', () => {
  it('says nothing when the line count did not increase', () => {
    const one = computeBingo(marksFor([0, 1, 2, 3, 4]));
    expect(bingoAnnouncement(1, one)).toBeNull();
    expect(bingoAnnouncement(2, one)).toBeNull();
    expect(bingoAnnouncement(0, computeBingo(marksFor([0, 1, 2])))).toBeNull();
  });

  it('names the first line and lands the joke', () => {
    const one = computeBingo(marksFor([0, 1, 2, 3, 4]));
    expect(bingoAnnouncement(0, one)).toBe('Bingo. Row 1 complete. Alignment has been achieved.');
  });

  it('reports the running total on later lines without repeating the joke', () => {
    const two = computeBingo(marksFor([0, 1, 2, 3, 4, 5, 10, 15, 20]));
    expect(two.lineCount).toBe(2);
    expect(bingoAnnouncement(1, two)).toBe('2 lines complete.');
  });

  it('announces a full card distinctly', () => {
    const full = computeBingo(new Array<boolean>(CELL_COUNT).fill(true));
    expect(bingoAnnouncement(0, full)).toBe('Full card. Every phrase on the card has been heard.');
    expect(bingoAnnouncement(11, full)).toBe('Full card. Every phrase on the card has been heard.');
  });
});
