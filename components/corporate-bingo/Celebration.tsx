import type { BingoState } from '@/lib/corporate-bingo';
import { pluralize } from '@/lib/corporate-bingo';
import styles from './corporate-bingo.module.css';

interface Props {
  bingo: BingoState;
}

/**
 * The bingo moment: a small, composed banner rather than a modal or a burst of
 * confetti. It appears once the first line lands (a subtle entrance, suppressed
 * under reduced motion), updates its count as more lines complete, and never
 * blocks the card — play continues underneath it. It is not a live region; the
 * timely announcement is made separately, so a screen reader hears it once.
 */
export function Celebration({ bingo }: Props) {
  const { headline, note } = describe(bingo);
  return (
    <aside className={styles.celebration} data-full={bingo.isFullCard || undefined}>
      <span className={styles.celebrationMark} aria-hidden="true">
        ✓
      </span>
      <span className={styles.celebrationText}>
        <strong className={styles.celebrationHeadline}>{headline}</strong>
        <span className={styles.celebrationNote}>{note}</span>
      </span>
    </aside>
  );
}

function describe(bingo: BingoState): { headline: string; note: string } {
  if (bingo.isFullCard) {
    return {
      headline: 'Full card.',
      note: 'Every phrase on the card, heard. Please circle back with your prize.',
    };
  }
  if (bingo.lineCount === 1) {
    return { headline: 'Bingo.', note: 'Alignment has been achieved.' };
  }
  return {
    headline: `Bingo ×${bingo.lineCount}.`,
    note: `${pluralize(bingo.lineCount, 'line')} complete — keep marking.`,
  };
}
