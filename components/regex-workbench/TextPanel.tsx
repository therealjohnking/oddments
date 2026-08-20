'use client';

import { LARGE_TEXT_WARN } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  text: string;
  onTextChange: (value: string) => void;
  onPaste: () => void;
  onClear: () => void;
}

export function TextPanel({ text, onTextChange, onPaste, onClear }: Props) {
  const large = text.length >= LARGE_TEXT_WARN;
  return (
    <section className={styles.panel} aria-label="Test text">
      <div className={styles.panelBody}>
        <label className={styles.patternField}>
          <span className={styles.fieldLabel}>Test text</span>
          <textarea
            className={styles.textarea}
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Paste the text to search — logs, code, a document…"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-describedby="rw-text-meta"
          />
        </label>
        <div className={styles.toolbar} style={{ marginTop: '0.6rem' }}>
          <button type="button" className={styles.btn} onClick={onPaste}>
            Paste
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onClear}
            disabled={text.length === 0}
          >
            Clear
          </button>
          <span className={styles.spacer} />
          <span id="rw-text-meta" className={styles.textMeta}>
            <span>{text.length.toLocaleString()} UTF-16 units</span>
            {large && (
              <span className={styles.warnText}>
                Large input — matching runs off the main thread and results are capped.
              </span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
