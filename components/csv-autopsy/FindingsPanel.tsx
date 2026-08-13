import { type CsvFinding, type FindingSeverity } from '@/lib/csv-autopsy';
import styles from './csv-autopsy.module.css';

const EXAMPLE_SHOWN = 8;

const SEVERITY: Record<FindingSeverity, { label: string; glyph: string }> = {
  warning: { label: 'Warning', glyph: '▲' },
  notice: { label: 'Notice', glyph: '◆' },
  info: { label: 'Info', glyph: '●' },
};

interface Props {
  findings: CsvFinding[];
  onCopyReport: () => void;
  onDownloadMarkdown: () => void;
  onDownloadJson: () => void;
  onFocusColumn: (index: number) => void;
}

function FindingCard({
  finding,
  onFocusColumn,
}: {
  finding: CsvFinding;
  onFocusColumn: (index: number) => void;
}) {
  const sev = SEVERITY[finding.severity];
  const shown = finding.examples.slice(0, EXAMPLE_SHOWN);
  const remaining = finding.examples.length - shown.length;

  return (
    <li className={styles.finding} data-sev={finding.severity}>
      <div className={styles.findingHead}>
        <span className={styles.sevChip} data-sev={finding.severity}>
          <span className={styles.sevGlyph} aria-hidden="true">
            {sev.glyph}
          </span>
          {sev.label}
        </span>
        <h3 className={styles.findingTitle}>{finding.title}</h3>
        {finding.columnIndex !== undefined && finding.column && (
          <button
            type="button"
            className={styles.findingCol}
            onClick={() => onFocusColumn(finding.columnIndex!)}
            title="Jump to this column"
          >
            {finding.column}
          </button>
        )}
      </div>
      <p className={styles.findingDetail}>{finding.detail}</p>
      <p className={styles.findingWhy}>{finding.why}</p>

      {finding.examples.length > 0 && (
        <details className={styles.examples}>
          <summary>
            {finding.count !== undefined ? `${finding.count.toLocaleString()} ` : ''}
            {finding.examples.length === 1 && (finding.count ?? 1) === 1 ? 'example' : 'examples'}
          </summary>
          <ul className={styles.exampleList}>
            {shown.map((example, index) => (
              <li className={styles.exampleItem} key={`${example.value}-${example.row ?? index}`}>
                <span className={styles.exampleValue}>{example.value}</span>
                {example.row !== undefined && (
                  <span className={styles.exampleRow}> · row {example.row.toLocaleString()}</span>
                )}
                {example.note && <span className={styles.exampleNote}> · {example.note}</span>}
              </li>
            ))}
          </ul>
          {(remaining > 0 || finding.examplesTruncated) && (
            <p className={styles.exampleMore}>
              {remaining > 0 ? `+ ${remaining.toLocaleString()} more shown examples` : ''}
              {finding.examplesTruncated
                ? ` (list capped; the ${finding.count?.toLocaleString() ?? ''} count is exact)`
                : ''}
            </p>
          )}
        </details>
      )}
    </li>
  );
}

export function FindingsPanel({
  findings,
  onCopyReport,
  onDownloadMarkdown,
  onDownloadJson,
  onFocusColumn,
}: Props) {
  return (
    <section className={styles.panel} aria-label="Findings">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Findings{' '}
          {findings.length > 0 && <span className={styles.panelHint}>({findings.length})</span>}
        </h2>
        <div className={styles.toolbar}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onCopyReport}
          >
            Copy report
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onDownloadMarkdown}
          >
            .md
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onDownloadJson}
          >
            .json
          </button>
        </div>
      </div>
      <div className={styles.panelBody}>
        {findings.length === 0 ? (
          <p className={styles.cleanState}>
            <span className={styles.cleanBadge}>Clean.</span> No structural, type, or consistency
            problems surfaced. Skim the column profiles below to confirm the types look right.
          </p>
        ) : (
          <ul className={styles.findingList}>
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onFocusColumn={onFocusColumn} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
