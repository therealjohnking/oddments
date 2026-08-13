import { formatBytes, formatNumber, formatPercent, type DatasetOverview } from '@/lib/csv-autopsy';
import styles from './csv-autopsy.module.css';

interface Props {
  overview: DatasetOverview;
}

function headerLabel(overview: DatasetOverview): string {
  if (!overview.hasHeader) return 'None';
  return overview.headerDetected ? 'Detected' : 'Assumed';
}

export function OverviewPanel({ overview }: Props) {
  const metrics: { value: string; label: string; small?: boolean; strong?: boolean }[] = [
    { value: formatNumber(overview.rows), label: 'Rows' },
    { value: formatNumber(overview.columns), label: 'Columns' },
    { value: overview.delimiterName, label: 'Delimiter', small: true },
    { value: headerLabel(overview), label: 'Header', small: true },
    { value: formatPercent(overview.completeness), label: 'Complete', small: false },
    { value: formatNumber(overview.blankRows), label: 'Blank rows' },
    { value: formatNumber(overview.duplicateRows), label: 'Dup. rows' },
    {
      value: formatNumber(overview.findingCount),
      label: 'Findings',
      strong: overview.findingCount > 0,
    },
  ];

  const bySev = overview.findingCountBySeverity;
  const noteParts: string[] = [
    `${formatNumber(overview.populatedCells)} of ${formatNumber(overview.totalCells)} cells populated`,
    `${overview.lineBreak.toUpperCase()} line endings`,
  ];
  if (overview.bom) noteParts.push('leading BOM');
  if (overview.fileSize !== null) noteParts.push(formatBytes(overview.fileSize));
  if (overview.findingCount > 0) {
    noteParts.push(`${bySev.warning} warning · ${bySev.notice} notice · ${bySev.info} info`);
  }

  return (
    <section className={styles.panel} aria-label="Dataset overview">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Overview</h2>
        {overview.truncated && (
          <span className={styles.panelHint}>
            analysis limited to first {formatNumber(overview.analyzedRows)} rows
          </span>
        )}
      </div>
      <div className={styles.panelBody}>
        <div className={styles.metricGrid}>
          {metrics.map((metric) => (
            <div
              className={`${styles.metric} ${metric.strong ? styles.metricStrong : ''}`}
              key={metric.label}
            >
              <span
                className={`${styles.metricValue} ${metric.small ? styles.metricValueSmall : ''}`}
              >
                {metric.value}
              </span>
              <span className={styles.metricLabel}>{metric.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.overviewNote}>{noteParts.join('  ·  ')}</p>
      </div>
    </section>
  );
}
