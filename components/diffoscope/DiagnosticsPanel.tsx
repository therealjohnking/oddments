import type { PairAnalysis, SubtleFinding, SubtlePosition, SubtleSeverity } from '@/lib/diffoscope';
import styles from './diffoscope.module.css';

const POSITIONS_SHOWN = 8;

const SEVERITY: Record<SubtleSeverity, { label: string; glyph: string }> = {
  warning: { label: 'Warning', glyph: '▲' },
  notice: { label: 'Notice', glyph: '◆' },
  info: { label: 'Info', glyph: '●' },
};

interface Props {
  analysis: PairAnalysis;
  onCopySummary: () => void;
}

function positionText(position: SubtlePosition): string {
  const parts: string[] = [];
  // Some findings (e.g. line-ending style) carry a line but no column.
  const sameLineNoColumn =
    position.aLine !== undefined &&
    position.aLine === position.bLine &&
    position.aColumn === undefined &&
    position.bColumn === undefined;
  if (sameLineNoColumn) {
    parts.push(`ln ${position.aLine}`);
  } else {
    if (position.aLine !== undefined) {
      parts.push(
        `A ln ${position.aLine}${position.aColumn !== undefined ? `:${position.aColumn}` : ''}`,
      );
    }
    if (position.bLine !== undefined) {
      parts.push(
        `B ln ${position.bLine}${position.bColumn !== undefined ? `:${position.bColumn}` : ''}`,
      );
    }
  }
  if (position.note) parts.push(position.note);
  return parts.join('  ·  ');
}

function FindingCard({ finding }: { finding: SubtleFinding }) {
  const sev = SEVERITY[finding.severity];
  const shown = finding.examples.slice(0, POSITIONS_SHOWN).map(positionText).filter(Boolean);
  const remaining = finding.count - shown.length;

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
        <span className={styles.findingCount}>×{finding.count.toLocaleString()}</span>
      </div>
      <p className={styles.findingDetail}>{finding.detail}</p>
      <p className={styles.findingWhy}>{finding.why}</p>
      {shown.length > 0 && (
        <details className={styles.positions}>
          <summary>{shown.length === 1 ? 'location' : 'locations'}</summary>
          <ul className={styles.positionList}>
            {shown.map((text, index) => (
              <li className={styles.positionItem} key={index}>
                {text}
              </li>
            ))}
          </ul>
          {(remaining > 0 || finding.examplesTruncated) && (
            <p className={styles.positionMore}>+ {Math.max(remaining, 0).toLocaleString()} more</p>
          )}
        </details>
      )}
    </li>
  );
}

/**
 * The "these look identical" surface: located, plain-language findings for the
 * subtle character-level differences (whitespace, invisibles, punctuation,
 * homoglyphs, case, line endings, Unicode form). This is also the fully
 * accessible, text-equivalent counterpart to the visual diff.
 */
export function DiagnosticsPanel({ analysis, onCopySummary }: Props) {
  const { findings } = analysis;

  return (
    <section className={styles.panel} aria-label="Subtle differences">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Subtle differences{' '}
          {findings.length > 0 && <span className={styles.panelHint}>({findings.length})</span>}
        </h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onCopySummary}
        >
          Copy summary
        </button>
      </div>
      <div className={styles.panelBody}>
        {analysis.exactlyEqual ? (
          <p className={styles.cleanState}>
            <span className={styles.cleanBadge}>Identical.</span> Every character matches — there is
            nothing hidden to find.
          </p>
        ) : analysis.charComparisonSkipped ? (
          <p className={styles.cleanState}>
            The inputs are too large for a per-character scan, so subtle-difference diagnostics were
            skipped. The comparison and counts above are still exact.
          </p>
        ) : findings.length === 0 ? (
          <p className={styles.cleanState}>
            <span className={styles.cleanBadge}>None.</span> No hidden whitespace, invisible
            characters, look-alike punctuation, or normalization differences surfaced — the changes
            are in the visible content.
          </p>
        ) : (
          <ul className={styles.findingList}>
            {findings.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
