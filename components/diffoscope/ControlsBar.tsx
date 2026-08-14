import type { DiffMode, LensState } from '@/lib/diffoscope';
import styles from './diffoscope.module.css';

export type DiffViewMode = 'inline' | 'split';

interface Props {
  mode: DiffMode;
  onMode: (mode: DiffMode) => void;
  view: DiffViewMode;
  onView: (view: DiffViewMode) => void;
  lens: LensState;
  onLens: (lens: LensState) => void;
}

const MODES: { id: DiffMode; label: string }[] = [
  { id: 'word', label: 'Word' },
  { id: 'char', label: 'Character' },
  { id: 'line', label: 'Line' },
];

/**
 * Compact comparison controls: granularity (word / character / line), the
 * inline-vs-split reading, and the comparison lenses. Lenses reinterpret how the
 * two sides are *matched* — they never alter either source.
 */
export function ControlsBar({ mode, onMode, view, onView, lens, onLens }: Props) {
  const toggle = (key: keyof LensState) => onLens({ ...lens, [key]: !lens[key] });

  return (
    <div className={styles.controls}>
      <div className={styles.controlGroup} role="group" aria-label="Comparison unit">
        <span className={styles.controlLabel}>Compare</span>
        <div className={styles.segmented}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={styles.segmentedBtn}
              aria-pressed={mode === m.id}
              onClick={() => onMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.controlGroup} role="group" aria-label="View">
        <span className={styles.controlLabel}>View</span>
        <div className={styles.segmented}>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={view === 'inline'}
            onClick={() => onView('inline')}
          >
            Inline
          </button>
          <button
            type="button"
            className={styles.segmentedBtn}
            aria-pressed={view === 'split'}
            onClick={() => onView('split')}
          >
            Split
          </button>
        </div>
      </div>

      <div className={styles.controlGroup} role="group" aria-label="Comparison lenses">
        <span className={styles.controlLabel}>Ignore</span>
        <label className={styles.lensChip}>
          <input type="checkbox" checked={lens.ignoreCase} onChange={() => toggle('ignoreCase')} />
          Case
        </label>
        <label className={styles.lensChip}>
          <input
            type="checkbox"
            checked={lens.ignoreWhitespace}
            onChange={() => toggle('ignoreWhitespace')}
          />
          Whitespace
        </label>
        <label className={styles.lensChip}>
          <input type="checkbox" checked={lens.nfc} onChange={() => toggle('nfc')} />
          Unicode form (NFC)
        </label>
      </div>
    </div>
  );
}
