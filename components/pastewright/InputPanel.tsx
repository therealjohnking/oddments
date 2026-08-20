'use client';

import { EXAMPLES, MAX_INPUT_LENGTH, type PastewrightExample } from '@/lib/pastewright';
import styles from './pastewright.module.css';

interface Props {
  markdown: string;
  onChange: (value: string) => void;
  onExample: (example: PastewrightExample) => void;
  onPaste: () => void;
  onClear: () => void;
}

export function InputPanel({ markdown, onChange, onExample, onPaste, onClear }: Props) {
  const near = markdown.length > MAX_INPUT_LENGTH * 0.9;

  return (
    <section className={styles.panel} aria-label="Markdown input">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Markdown</h2>
        <div className={styles.toolbar}>
          <button type="button" className={styles.btn} onClick={onPaste}>
            Paste
          </button>
          <button type="button" className={styles.btn} onClick={onClear} disabled={markdown === ''}>
            Clear
          </button>
        </div>
      </div>
      <div className={styles.panelBody}>
        <label className="visually-hidden" htmlFor="pw-input">
          Markdown to convert
        </label>
        <textarea
          id="pw-input"
          className={styles.textarea}
          value={markdown}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Paste Markdown here — headings, lists, links, code, and tables all welcome."
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Examples:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              className={styles.exampleChip}
              onClick={() => onExample(example)}
              title={example.blurb}
            >
              {example.label}
            </button>
          ))}
        </div>
        {near && (
          <p className={styles.warnText}>
            That&rsquo;s a large document — conversion happens locally and may take a moment.
          </p>
        )}
      </div>
    </section>
  );
}
