'use client';

import type { Diagnostic, DiagnosticSeverity } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

const SEVERITY: Record<DiagnosticSeverity, { label: string; glyph: string }> = {
  warning: { label: 'Warning', glyph: '▲' },
  notice: { label: 'Notice', glyph: '◆' },
  info: { label: 'Info', glyph: '●' },
};

export function DiagnosticsPanel({ diagnostics }: { diagnostics: Diagnostic[] }) {
  if (diagnostics.length === 0) return null;

  return (
    <section className={styles.panel} aria-label="Diagnostics">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Diagnostics</h2>
        <span className={styles.panelHint}>({diagnostics.length})</span>
      </div>
      <div className={styles.panelBody}>
        <ul className={styles.findingList}>
          {diagnostics.map((finding) => {
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
                {finding.why && <p className={styles.findingWhy}>{finding.why}</p>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
