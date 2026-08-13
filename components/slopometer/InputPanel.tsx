import styles from './slopometer.module.css';

interface Props {
  value: string;
  wordCount: number;
  onChange: (value: string) => void;
  onPaste: () => void;
  onExample: () => void;
  onClear: () => void;
}

export function InputPanel({ value, wordCount, onChange, onPaste, onExample, onClear }: Props) {
  return (
    <div>
      <div className={styles.toolbar}>
        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onExample}>
          Load example
        </button>
        <button type="button" className={styles.btn} onClick={onPaste}>
          Paste from clipboard
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onClear}
          disabled={value.length === 0}
        >
          Clear
        </button>
        <span className={styles.spacer} />
        <span className={styles.counter}>
          {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'}
        </span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Prose to analyze</span>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste or type prose — a blog post, a bio, an announcement, that email you're not sure about."
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="soft"
          aria-describedby="slopometer-help"
        />
      </label>
      <p id="slopometer-help" className={styles.help}>
        Everything runs locally, in your browser, as you type. Nothing is uploaded, and the score is
        a playful heuristic — not a measurement, a grade, or a guess about who or what wrote this.
      </p>
    </div>
  );
}
