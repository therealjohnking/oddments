import styles from './inspector.module.css';

interface Props {
  value: string;
  codePointCount: number;
  onChange: (value: string) => void;
  onPaste: () => void;
  onExample: () => void;
  onClear: () => void;
}

export function InputPanel({
  value,
  codePointCount,
  onChange,
  onPaste,
  onExample,
  onClear,
}: Props) {
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
        <span className={styles.counter}>{codePointCount.toLocaleString()} characters</span>
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Text to inspect</span>
        <textarea
          className={styles.textarea}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste or type here — try a snippet copied from a PDF, a chat message, or code."
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          wrap="soft"
          aria-describedby="inspector-help"
        />
      </label>
      <p id="inspector-help" className={styles.help}>
        Detection runs locally, in your browser, as you type. Your text is never uploaded, and the
        exact characters you paste are preserved.
      </p>
    </div>
  );
}
