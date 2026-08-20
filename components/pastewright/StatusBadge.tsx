'use client';

import type { TransformStatus } from '@/lib/pastewright';
import styles from './pastewright.module.css';

const GLYPH: Record<TransformStatus['kind'], string> = {
  preserved: '✓',
  adapted: '↹',
  compromised: '△',
};

export function StatusBadge({ status }: { status: TransformStatus }) {
  return (
    <span className={styles.statusBadge} data-kind={status.kind} title={status.summary}>
      <span aria-hidden="true">{GLYPH[status.kind]}</span>
      {status.label}
    </span>
  );
}
