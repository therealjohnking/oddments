import { useMemo } from 'react';
import { buildAnnotatedSegments, type EvidenceItem } from './segments';
import styles from './slopometer.module.css';

const ANNOTATE_MAX_CHARS = 20_000;

interface Props {
  text: string;
  evidence: EvidenceItem[];
  focusedEvidence: string | null;
  onSelectEvidence: (id: string) => void;
}

/**
 * The annotated prose: the original text with every flagged span highlighted in
 * place. It is a sighted enhancement (aria-hidden) — the Findings list is the
 * equivalent accessible surface, and the raw text remains in the textarea. Marks
 * are not individually tab-stoppable (there can be hundreds); keyboard users
 * navigate findings instead.
 */
export function AnnotatedPanel({ text, evidence, focusedEvidence, onSelectEvidence }: Props) {
  const { segments, truncated } = useMemo(
    () => buildAnnotatedSegments(text, evidence, ANNOTATE_MAX_CHARS),
    [text, evidence],
  );

  return (
    <section className={styles.panel} aria-label="Annotated text">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>In context</h2>
        <span className={styles.panelHint}>
          {evidence.length > 0
            ? `${evidence.length.toLocaleString()} highlighted ${evidence.length === 1 ? 'span' : 'spans'}`
            : 'nothing flagged'}
        </span>
      </div>

      <div className={styles.annotated} aria-hidden="true">
        {segments.length === 0 ? (
          <span style={{ color: 'var(--text-faint)' }}>Nothing to highlight here.</span>
        ) : (
          segments.map((segment, index) => {
            if (segment.kind === 'text') {
              return <span key={index}>{segment.text}</span>;
            }
            const { item } = segment;
            const title = `${item.title}${item.note ? ` — ${item.note}` : ''}`;
            return (
              <mark
                key={`${item.id}-${index}`}
                id={`slop-mark-${item.id}`}
                className={styles.mark}
                data-focused={focusedEvidence === item.id}
                title={title}
                onClick={() => onSelectEvidence(item.id)}
              >
                {segment.text}
              </mark>
            );
          })
        )}
      </div>

      {truncated && (
        <p className={styles.annotatedFootNote}>
          Showing the first {ANNOTATE_MAX_CHARS.toLocaleString()} characters. The score and findings
          cover the entire input.
        </p>
      )}
    </section>
  );
}
