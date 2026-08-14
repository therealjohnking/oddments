'use client';

import { useMemo, useState } from 'react';
import { type JsonNode, toMinified, toPretty, toSortedKeys } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

type Format = 'pretty' | 'minified' | 'sorted';

const DISPLAY_CAP = 100_000;

interface Props {
  tree: JsonNode;
  source: string;
  hasDuplicateKeys: boolean;
  onCopy: (text: string, label: string) => void;
  onDownload: (suffix: string, text: string, mime: string) => void;
}

export function FormattedPanel({ tree, source, hasDuplicateKeys, onCopy, onDownload }: Props) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<Format>('pretty');

  const effectiveFormat: Format = format === 'sorted' && hasDuplicateKeys ? 'pretty' : format;

  const output = useMemo(() => {
    if (!open) return '';
    switch (effectiveFormat) {
      case 'minified':
        return toMinified(tree, source);
      case 'sorted':
        return toSortedKeys(tree, source);
      default:
        return toPretty(tree, source);
    }
  }, [open, effectiveFormat, tree, source]);

  const display =
    output.length > DISPLAY_CAP
      ? output.slice(0, DISPLAY_CAP) +
        '\n… (truncated for display; copy or download for the full output)'
      : output;

  const suffix =
    effectiveFormat === 'minified'
      ? 'min.json'
      : effectiveFormat === 'sorted'
        ? 'sorted.json'
        : 'pretty.json';

  return (
    <section className={styles.panel} aria-label="Formatted views">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Formatted views</h2>
        <div className={styles.toolbar}>
          <label className={styles.panelHint}>
            <span className="visually-hidden">Format</span>
            <select
              className={styles.select}
              value={format}
              onChange={(event) => setFormat(event.target.value as Format)}
              disabled={!open}
            >
              <option value="pretty">Pretty (2-space)</option>
              <option value="minified">Minified</option>
              <option value="sorted" disabled={hasDuplicateKeys}>
                Sort keys{hasDuplicateKeys ? ' (unavailable)' : ''}
              </option>
            </select>
          </label>
          <button
            type="button"
            className={styles.btn}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? 'Hide' : 'Show'}
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => onCopy(output, 'Formatted JSON')}
            disabled={!open}
          >
            Copy
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={() => onDownload(suffix, output, 'application/json')}
            disabled={!open}
          >
            Download
          </button>
        </div>
      </div>
      {open && (
        <div className={styles.panelBody}>
          <pre className={styles.formatOut}>{display}</pre>
          <p className={styles.formatNote}>
            A derived view of your document — the original source is never modified. Numbers and
            string escapes are reproduced exactly, and duplicate keys are preserved.
            {hasDuplicateKeys
              ? ' Key-sorting is disabled because duplicate keys make member order meaningful.'
              : ''}
          </p>
        </div>
      )}
    </section>
  );
}
