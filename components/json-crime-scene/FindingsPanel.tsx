import { type FindingSeverity, type JsonFinding } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

const EXAMPLE_SHOWN = 8;

const SEVERITY: Record<FindingSeverity, { label: string; glyph: string }> = {
  warning: { label: 'Warning', glyph: '▲' },
  notice: { label: 'Notice', glyph: '◆' },
  info: { label: 'Info', glyph: '●' },
};

interface Props {
  findings: JsonFinding[];
  onCopyReport: () => void;
  onDownloadMarkdown: () => void;
  onDownloadJson: () => void;
  onNavigate: (pointer: string) => void;
}

function ptrLabel(pointer: string): string {
  return pointer === '' ? '(root)' : pointer;
}

function FindingCard({
  finding,
  onNavigate,
}: {
  finding: JsonFinding;
  onNavigate: (pointer: string) => void;
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
        <span className={styles.catTag}>{finding.category}</span>
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
              <li className={styles.exampleItem} key={`${example.pointer}-${index}`}>
                {example.label && <span className={styles.exampleValue}>{example.label}</span>}
                {example.note && <span className={styles.exampleNote}>{example.note}</span>}
                <button
                  type="button"
                  className={styles.examplePtr}
                  onClick={() => onNavigate(example.pointer)}
                  title="Reveal in the tree"
                >
                  {ptrLabel(example.pointer)}
                </button>
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
  onNavigate,
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
            <span className={styles.cleanBadge}>Nothing suspicious.</span> The structure parsed
            cleanly and no duplicate keys, type inconsistencies, or unusual characters surfaced.
            Explore the tree below to see it for yourself.
          </p>
        ) : (
          <ul className={styles.findingList}>
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} onNavigate={onNavigate} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
