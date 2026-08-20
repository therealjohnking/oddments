'use client';

import { destinationMeta, type TransformResult } from '@/lib/pastewright';
import { RichPreview } from './RichPreview';
import styles from './pastewright.module.css';

export function Preview({ result }: { result: TransformResult }) {
  const meta = destinationMeta(result.destination);
  const isRich = result.destination === 'rich' && result.rich !== null;

  return (
    <div className={styles.previewWrap}>
      <div className={styles.previewHead}>
        <span className={styles.previewLabel}>Preview</span>
        <span className={styles.previewNote}>
          Different apps may style pasted content differently.
        </span>
      </div>
      {isRich ? (
        <div className={styles.richPreview}>
          <RichPreview nodes={result.rich!} />
        </div>
      ) : (
        <pre className={styles.plainPreview} data-font={meta.previewFont}>
          {result.text === '' ? ' ' : result.text}
        </pre>
      )}
    </div>
  );
}
