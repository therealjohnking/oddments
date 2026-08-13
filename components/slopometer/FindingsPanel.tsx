import {
  SLOP_CATEGORIES,
  type Analysis,
  type Finding,
  type SlopCategoryId,
} from '@/lib/slopometer';
import styles from './slopometer.module.css';

const OCC_LIMIT = 24;

interface Props {
  analysis: Analysis;
  activeCategory: SlopCategoryId | null;
  focusedEvidence: string | null;
  onSelectEvidence: (id: string) => void;
  onClearFilter: () => void;
  onCopyText: (text: string, successMessage: string) => void;
}

function buildReport(analysis: Analysis): string {
  const lines: string[] = ['Slopometer report', ''];
  lines.push(`Score: ${analysis.score} / 100 — ${analysis.band.label}`);
  lines.push(
    `Words: ${analysis.metrics.words}  ·  Sentences: ${analysis.metrics.sentences}  ·  Paragraphs: ${analysis.metrics.paragraphs}`,
  );
  lines.push('', 'Slopometer detects writing crimes, not authorship. The score is a heuristic.');
  if (analysis.findings.length > 0) {
    lines.push('', 'Findings (by contribution):');
    for (const finding of analysis.findings) {
      lines.push(
        `  +${finding.contribution}  ${finding.title} — ${finding.detail ?? finding.explanation}`,
      );
    }
  } else {
    lines.push('', 'No stylistic tells detected.');
  }
  return lines.join('\n');
}

function FindingCard({
  finding,
  focusedEvidence,
  onSelectEvidence,
}: {
  finding: Finding;
  focusedEvidence: string | null;
  onSelectEvidence: (id: string) => void;
}) {
  const shown = finding.evidence.slice(0, OCC_LIMIT);
  const remaining = finding.occurrences - shown.length;

  return (
    <div className={styles.finding}>
      <div className={styles.findingHead}>
        <h3 className={styles.findingTitle}>{finding.title}</h3>
        {finding.atCap && <span className={styles.capBadge}>max</span>}
        <span className={styles.contribBadge}>+{finding.contribution}</span>
      </div>
      <p className={styles.findingCat}>{SLOP_CATEGORIES[finding.category].label}</p>
      <p className={styles.findingText}>{finding.explanation}</p>
      {finding.detail && finding.evidence.length === 0 && (
        <p className={styles.findingDetail}>{finding.detail}</p>
      )}

      {finding.evidence.length > 0 && (
        <details className={styles.occToggle}>
          <summary>
            {finding.occurrences} {finding.occurrences === 1 ? 'occurrence' : 'occurrences'} — show
            in context
          </summary>
          <ul className={styles.occList}>
            {shown.map((ev) => (
              <li key={ev.id}>
                <button
                  type="button"
                  className={styles.occ}
                  data-focused={focusedEvidence === ev.id}
                  onClick={() => onSelectEvidence(ev.id)}
                  title="Jump to this in the text"
                >
                  <span className={styles.occQuote}>{ev.excerpt}</span>
                </button>
              </li>
            ))}
          </ul>
          {remaining > 0 && (
            <p className={styles.occMore}>
              + {remaining.toLocaleString()} more
              {finding.evidenceTruncated ? ' (list truncated)' : ''}
            </p>
          )}
        </details>
      )}
    </div>
  );
}

export function FindingsPanel({
  analysis,
  activeCategory,
  focusedEvidence,
  onSelectEvidence,
  onClearFilter,
  onCopyText,
}: Props) {
  const visible = activeCategory
    ? analysis.findings.filter((f) => f.category === activeCategory)
    : analysis.findings;

  return (
    <section className={styles.panel} aria-label="Findings">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Findings</h2>
        <div className={styles.toolbar} style={{ margin: 0 }}>
          {activeCategory && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={onClearFilter}
            >
              Clear filter ✕
            </button>
          )}
          {analysis.findings.length > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() =>
                onCopyText(buildReport(analysis), 'Slopometer report copied to the clipboard.')
              }
            >
              Copy report
            </button>
          )}
        </div>
      </div>

      <div className={styles.panelBody}>
        {analysis.findings.length === 0 ? (
          <p className={styles.emptyFindings}>
            <span className={styles.cleanBadge}>Clean.</span> No stylistic tells detected — either
            genuinely plain writing, or a very disciplined author.
          </p>
        ) : (
          <>
            {activeCategory && (
              <p className={styles.findingCat} style={{ marginTop: 0, marginBottom: '0.6rem' }}>
                Filtered to {SLOP_CATEGORIES[activeCategory].label}. {visible.length} of{' '}
                {analysis.findings.length} findings.
              </p>
            )}
            {visible.map((finding) => (
              <FindingCard
                key={finding.ruleId}
                finding={finding}
                focusedEvidence={focusedEvidence}
                onSelectEvidence={onSelectEvidence}
              />
            ))}
          </>
        )}
      </div>
    </section>
  );
}
