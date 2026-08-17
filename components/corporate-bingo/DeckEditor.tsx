'use client';

import { useId, useMemo, useState } from 'react';
import { MIN_DECK_SIZE, pluralize, validateDeck } from '@/lib/corporate-bingo';
import styles from './corporate-bingo.module.css';

interface Props {
  /** Editor text for the currently active deck; a change reseeds the textarea. */
  seedText: string;
  /** Whether the active deck is the user's custom list. */
  isCustom: boolean;
  /** How many phrases the active deck holds. */
  activeCount: number;
  onApply: (phrases: string[]) => void;
  onRestoreDefault: () => void;
}

/**
 * The phrase-deck editor: one phrase per line in a plain textarea. Validation is
 * live — the same normalization the engine uses (trim, drop blanks, de-duplicate)
 * runs as you type — and the user's text is never discarded, even when it is too
 * short to deal a card. A deliberately small surface: no per-phrase CRUD, just a
 * textarea, a live count, and two clear actions.
 */
export function DeckEditor({ seedText, isCustom, activeCount, onApply, onRestoreDefault }: Props) {
  const [deckText, setDeckText] = useState(seedText);
  const [seenSeed, setSeenSeed] = useState(seedText);
  const helpId = useId();
  const statusId = useId();

  // Reseed only when the *active* deck changes (an apply/restore elsewhere),
  // detected by adjusting state during render — React's blessed pattern for
  // resetting state on a prop change. Local edits leave `seedText` untouched, so
  // in-progress text (even invalid text) is never clobbered.
  if (seedText !== seenSeed) {
    setSeenSeed(seedText);
    setDeckText(seedText);
  }

  const validation = useMemo(() => validateDeck(deckText), [deckText]);

  return (
    <details className={styles.deckPanel}>
      <summary className={styles.deckSummary}>
        <span className={styles.deckSummaryTitle}>Customize phrases</span>
        <span className={styles.deckSummaryMeta}>
          {isCustom ? 'custom deck' : 'default deck'} · {pluralize(activeCount, 'phrase')}
        </span>
      </summary>

      <div className={styles.deckBody}>
        <label className={styles.field}>
          <span className={styles.fieldLabel}>Phrase deck — one per line</span>
          <textarea
            className={styles.deckTextarea}
            value={deckText}
            onChange={(event) => setDeckText(event.target.value)}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="soft"
            aria-describedby={`${helpId} ${statusId}`}
          />
        </label>

        <p id={helpId} className={styles.deckHelp}>
          A card needs at least {MIN_DECK_SIZE} different phrases. Blank lines are ignored, and
          duplicates (ignoring case and spacing) are counted once. Your deck is saved in this
          browser only.
        </p>

        <p id={statusId} className={validation.ok ? styles.deckOk : styles.deckError} role="status">
          {validation.ok
            ? `${pluralize(validation.uniqueCount, 'unique phrase')} — ready to deal.`
            : validation.error}
        </p>

        <div className={styles.deckActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={() => onApply(validation.phrases)}
            disabled={!validation.ok}
          >
            Save &amp; deal from these
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onRestoreDefault}
          >
            Restore default deck
          </button>
        </div>
      </div>
    </details>
  );
}
