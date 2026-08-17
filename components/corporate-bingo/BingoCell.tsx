import type { Cell } from '@/lib/corporate-bingo';
import styles from './corporate-bingo.module.css';

interface Props {
  cell: Cell;
  index: number;
  marked: boolean;
  /** True when this square is part of at least one completed line. */
  inLine: boolean;
  onToggle: (index: number) => void;
}

/**
 * One square on the card. The FREE center is a static, always-marked label (not a
 * control); every other square is a toggle button whose pressed state carries the
 * mark. State is never signalled by colour alone — a marked square shows a check
 * glyph, and a square in a completed line adds a distinct ring on top of the mark.
 */
export function BingoCell({ cell, index, marked, inLine, onToggle }: Props) {
  if (cell.kind === 'free') {
    return (
      <div
        className={styles.cell}
        data-free="true"
        data-marked="true"
        data-line={inLine || undefined}
      >
        <span className={styles.freeText} aria-hidden="true">
          FREE
        </span>
        <span className="visually-hidden">Free space, already marked.</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={styles.cell}
      aria-pressed={marked}
      data-marked={marked || undefined}
      data-line={inLine || undefined}
      onClick={() => onToggle(index)}
    >
      <span className={styles.cellText}>{cell.text}</span>
      <span className={styles.check} aria-hidden="true" />
    </button>
  );
}
