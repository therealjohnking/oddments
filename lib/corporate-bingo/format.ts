/**
 * Small formatting helpers with enough logic to be worth testing on their own:
 * pluralization, joining line names into a readable list, and the live-region
 * copy announced when bingo lands or grows. Keeping these here (rather than in a
 * component) means the exact wording is unit-tested and the UI stays declarative.
 */

import type { BingoState, Card, WinLine } from './types';

/**
 * A short, stable "serial" for a card — four base-36 characters derived from its
 * phrases (FNV-1a). Pure personality: it gives each dealt card a bit of
 * instrument-panel identity and changes when a new card is dealt. Not a
 * cryptographic hash and not used for anything but display.
 */
export function cardSerial(card: Card): string {
  const text = card.map((cell) => (cell.kind === 'phrase' ? cell.text : '·')).join('|');
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36).toUpperCase().padStart(4, '0').slice(-4);
}

/** `1 line`, `2 lines` — count plus the right noun form. */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Join line labels into prose: "Row 1", "Row 1 and Column 2", or "Row 1, Column
 * 2, and the main diagonal" (Oxford comma). Diagonal labels are lowercased and
 * given an article so they read naturally mid-sentence.
 */
export function formatLineList(lines: readonly WinLine[]): string {
  const names = lines.map((line) =>
    line.kind === 'diagonal' ? `the ${line.label.toLocaleLowerCase()}` : line.label,
  );
  if (names.length === 0) return '';
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** A compact, dry summary of progress for the stats row. */
export function summarizeProgress(bingo: BingoState): string {
  if (bingo.isFullCard) return 'Full card — every phrase heard.';
  if (bingo.hasBingo) {
    return `${pluralize(bingo.lineCount, 'line')} complete · ${pluralize(bingo.remaining, 'phrase')} to go.`;
  }
  return `${pluralize(bingo.markedPhrases, 'phrase')} marked · ${pluralize(bingo.remaining, 'phrase')} to go.`;
}

/**
 * The message announced to a screen reader when the number of completed lines
 * changes. Fires only on an increase (the caller compares against the previous
 * count), so it is not repeated on every tap. `null` when nothing new landed.
 */
export function bingoAnnouncement(previousLines: number, bingo: BingoState): string | null {
  if (bingo.lineCount <= previousLines) return null;

  if (bingo.isFullCard) {
    return 'Full card. Every phrase on the card has been heard.';
  }
  if (previousLines === 0) {
    // The first line: name it, and land the joke.
    return `Bingo. ${formatLineList(bingo.completedLines.slice(0, 1))} complete. Alignment has been achieved.`;
  }
  return `${pluralize(bingo.lineCount, 'line')} complete.`;
}
