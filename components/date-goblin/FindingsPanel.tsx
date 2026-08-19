'use client';

import type { Finding, FindingSeverity } from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

const SEVERITY: Record<FindingSeverity, { label: string; glyph: string }> = {
  warning: { label: 'Warning', glyph: '▲' },
  notice: { label: 'Notice', glyph: '◆' },
  info: { label: 'Info', glyph: '●' },
};

export function FindingsPanel({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Notes and explanations">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Notes &amp; explanations</h2>
        <span className={styles.panelHint}>({findings.length})</span>
      </div>
      <div className={styles.panelBody}>
        <ul className={styles.findingList}>
          {findings.map((finding) => {
            const sev = SEVERITY[finding.severity];
            return (
              <li key={finding.id} className={styles.finding} data-sev={finding.severity}>
                <div className={styles.findingHead}>
                  <span className={styles.sevChip} data-sev={finding.severity}>
                    <span aria-hidden="true">{sev.glyph}</span>
                    {sev.label}
                  </span>
                  <h3 className={styles.findingTitle}>{finding.title}</h3>
                </div>
                <p className={styles.findingDetail}>{finding.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
