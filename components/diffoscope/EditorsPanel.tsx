import { EXAMPLES } from '@/lib/diffoscope';
import styles from './diffoscope.module.css';

interface Props {
  a: string;
  b: string;
  aChars: number;
  bChars: number;
  onChangeA: (value: string) => void;
  onChangeB: (value: string) => void;
  onSwap: () => void;
  onClear: () => void;
  onExample: (id: string) => void;
}

/**
 * The two source editors (A / Before and B / After) plus the compact input
 * toolbar. Native textareas keep the exact pasted characters intact — the
 * comparison never modifies either side.
 */
export function EditorsPanel({
  a,
  b,
  aChars,
  bChars,
  onChangeA,
  onChangeB,
  onSwap,
  onClear,
  onExample,
}: Props) {
  const hasInput = a.length > 0 || b.length > 0;

  return (
    <div>
      <div className={styles.toolbar}>
        <label className={styles.controlLabel} htmlFor="diff-example">
          Example
        </label>
        <select
          id="diff-example"
          className={styles.select}
          value=""
          onChange={(event) => {
            if (event.target.value) onExample(event.target.value);
          }}
        >
          <option value="" disabled>
            Load an example…
          </option>
          {EXAMPLES.map((example) => (
            <option key={example.id} value={example.id}>
              {example.label}
            </option>
          ))}
        </select>
        <button type="button" className={styles.btn} onClick={onSwap} disabled={!hasInput}>
          ⇄ Swap
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onClear}
          disabled={!hasInput}
        >
          Clear
        </button>
      </div>

      <div className={styles.editors}>
        <div className={styles.editor}>
          <div className={styles.editorHead}>
            <label className={styles.editorLabel} htmlFor="diff-a">
              A <span>/ Before</span>
            </label>
            <span className={styles.editorCount}>{aChars.toLocaleString()} chars</span>
          </div>
          <textarea
            id="diff-a"
            data-side="a"
            className={styles.textarea}
            value={a}
            onChange={(event) => onChangeA(event.target.value)}
            placeholder="Paste the original text here."
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="soft"
          />
        </div>

        <div className={styles.editor}>
          <div className={styles.editorHead}>
            <label className={styles.editorLabel} htmlFor="diff-b">
              B <span>/ After</span>
            </label>
            <span className={styles.editorCount}>{bChars.toLocaleString()} chars</span>
          </div>
          <textarea
            id="diff-b"
            data-side="b"
            className={styles.textarea}
            value={b}
            onChange={(event) => onChangeB(event.target.value)}
            placeholder="Paste the changed text here."
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="soft"
          />
        </div>
      </div>

      <p className={styles.help}>
        Everything is compared locally in your browser as you type — nothing is uploaded, and the
        exact characters you paste are preserved on both sides.
      </p>
    </div>
  );
}
