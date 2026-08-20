'use client';

import { destinationMeta, type TableLayout, type TransformResult } from '@/lib/pastewright';
import { StatusBadge } from './StatusBadge';
import { TableLayoutControl } from './TableLayoutControl';
import { Preview } from './Preview';
import styles from './pastewright.module.css';

interface Props {
  result: TransformResult;
  tableLayout: TableLayout;
  onTableLayout: (value: TableLayout) => void;
  onCopyPrimary: () => void;
  onCopyPlain: () => void;
}

export function ResultPanel({
  result,
  tableLayout,
  onTableLayout,
  onCopyPrimary,
  onCopyPlain,
}: Props) {
  const meta = destinationMeta(result.destination);

  return (
    <section className={styles.panel} aria-label={`Result for ${meta.label}`}>
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>{meta.label}</h2>
        <StatusBadge status={result.status} />
      </div>
      <div className={styles.panelBody}>
        <div className={styles.copyRow}>
          <button type="button" className={styles.copyPrimary} onClick={onCopyPrimary}>
            {meta.copyLabel}
          </button>
          {result.destination === 'rich' && (
            <button type="button" className={styles.btn} onClick={onCopyPlain}>
              Copy as plain text
            </button>
          )}
          <span className={styles.charCount}>{result.charCount.toLocaleString()} characters</span>
        </div>

        {result.showTableControl && (
          <TableLayoutControl value={tableLayout} onChange={onTableLayout} />
        )}

        {!result.showTableControl && result.destination === 'linkedin' && result.tableCount > 0 && (
          <p className={styles.tableNote}>
            Tables use a record layout here — LinkedIn&rsquo;s proportional font re-wraps text, so
            aligned columns (which rely on fixed-width spacing) can&rsquo;t stay lined up.
          </p>
        )}

        <Preview result={result} />
      </div>
    </section>
  );
}
