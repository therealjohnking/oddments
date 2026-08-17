'use client';

import { useEffect, useRef } from 'react';
import styles from './corporate-bingo.module.css';

interface Props {
  /** Whether "New card" should confirm first (there is progress worth protecting). */
  confirming: boolean;
  canReset: boolean;
  onNewCard: () => void;
  onConfirmNew: () => void;
  onCancelNew: () => void;
  onReset: () => void;
}

/**
 * The two current-card controls. "New card" reshuffles into a fresh card; because
 * that discards the current one, it asks for a light inline confirmation — but
 * only when there is real progress to lose (the parent decides). "Reset marks"
 * clears the taps without ever reshuffling, so it needs no confirmation.
 *
 * Swapping between the default controls and the confirm prompt unmounts whichever
 * button had focus, so we move focus deliberately on each transition (to the
 * confirm action, then back to "New card") — otherwise a keyboard user would be
 * dropped to the top of the document mid-flow.
 */
export function CardControls({
  confirming,
  canReset,
  onNewCard,
  onConfirmNew,
  onCancelNew,
  onReset,
}: Props) {
  const newCardRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const wasConfirming = useRef(false);

  useEffect(() => {
    if (confirming && !wasConfirming.current) {
      confirmRef.current?.focus();
    } else if (!confirming && wasConfirming.current) {
      newCardRef.current?.focus();
    }
    wasConfirming.current = confirming;
  }, [confirming]);

  if (confirming) {
    return (
      <div className={styles.controls}>
        <span className={styles.confirmPrompt} role="status">
          Deal a new card? This clears the current one.
        </span>
        <button
          ref={confirmRef}
          type="button"
          className={`${styles.btn} ${styles.btnPrimary}`}
          onClick={onConfirmNew}
        >
          Deal new card
        </button>
        <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onCancelNew}>
          Keep this card
        </button>
      </div>
    );
  }

  return (
    <div className={styles.controls}>
      <button
        ref={newCardRef}
        type="button"
        className={`${styles.btn} ${styles.btnPrimary}`}
        onClick={onNewCard}
      >
        New card
      </button>
      <button
        type="button"
        className={styles.btn}
        onClick={onReset}
        disabled={!canReset}
        title="Clear your marks but keep the same phrases"
      >
        Reset marks
      </button>
    </div>
  );
}
