'use client';

import type { Finding, FindingImpact, TransformStatus } from '@/lib/pastewright';
import styles from './pastewright.module.css';

const IMPACT: Record<FindingImpact, { label: string; glyph: string }> = {
  preserved: { label: 'Preserved', glyph: '✓' },
  adapted: { label: 'Adapted', glyph: '↹' },
  compromised: { label: 'Compromise', glyph: '△' },
};

interface Props {
  findings: Finding[];
  status: TransformStatus;
}

export function ReportPanel({ findings, status }: Props) {
  return (
    <section className={styles.panel} aria-label="Destination adjustments">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Destination adjustments</h2>
        <span className={styles.panelHint}>{status.summary}</span>
      </div>
      <div className={styles.panelBody}>
        {findings.length === 0 ? (
          <p className={styles.reportEmpty}>
            Nothing needed changing — this document is represented without structural loss.
          </p>
        ) : (
          <ul className={styles.findingList}>
            {findings.map((finding) => {
              const impact = IMPACT[finding.impact];
              return (
                <li key={finding.id} className={styles.finding} data-impact={finding.impact}>
                  <div className={styles.findingHead}>
                    <span className={styles.impactChip} data-impact={finding.impact}>
                      <span aria-hidden="true">{impact.glyph}</span>
                      {impact.label}
                    </span>
                    <h3 className={styles.findingTitle}>{finding.title}</h3>
                  </div>
                  <p className={styles.findingDetail}>{finding.detail}</p>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
