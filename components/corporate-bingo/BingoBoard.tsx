import type { BingoState, Card } from '@/lib/corporate-bingo';
import { BingoCell } from './BingoCell';
import styles from './corporate-bingo.module.css';

interface Props {
  card: Card;
  marks: boolean[];
  bingo: BingoState;
  onToggle: (index: number) => void;
}

/**
 * The 5×5 card. Rendered as a labelled group of toggle buttons in a CSS grid —
 * the simplest semantics that is correct here. Each square is its own control
 * with normal tab order; we deliberately avoid an ARIA `grid` with roving
 * tabindex, which is easy to implement subtly wrong and buys nothing for a board
 * this small.
 */
export function BingoBoard({ card, marks, bingo, onToggle }: Props) {
  return (
    <div
      className={styles.board}
      role="group"
      aria-label="Bingo card, 5 columns by 5 rows. Tap a phrase when you hear it."
    >
      {card.map((cell, index) => (
        <BingoCell
          key={index}
          cell={cell}
          index={index}
          marked={marks[index] === true}
          inLine={bingo.participating[index] === true}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
