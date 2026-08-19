'use client';

import type { AmbiguityCandidate, ParseError } from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

interface AmbiguousProps {
  kind: 'ambiguous';
  message: string;
  candidates: AmbiguityCandidate[];
  hint?: string;
}

interface ErrorProps {
  kind: 'error';
  error: ParseError;
}

type Props = AmbiguousProps | ErrorProps;

/** Renders the non-instant outcomes — an ambiguity we won't guess, or an error. */
export function NoticePanel(props: Props) {
  if (props.kind === 'ambiguous') {
    return (
      <section
        className={`${styles.panel}`}
        aria-label="Ambiguous input"
        role="status"
        aria-live="polite"
      >
        <div className={styles.panelBody}>
          <div className={`${styles.notice} ${styles.noticeAmbiguous}`}>
            <p className={styles.noticeTitle}>Ambiguous date format</p>
            <p className={styles.noticeMsg}>{props.message}</p>
            {props.candidates.length > 0 && (
              <ul className={styles.candidates}>
                {props.candidates.map((candidate, index) => (
                  <li key={`${candidate.preview}-${index}`} className={styles.candidate}>
                    <span className={styles.candidateLabel}>{candidate.label}:</span>
                    <span className={styles.candidatePreview}>{candidate.preview}</span>
                    <span className={styles.candidateDetail}>{candidate.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {props.hint && <p className={styles.noticeHint}>{props.hint}</p>}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={styles.panel}
      aria-label="Could not interpret"
      role="status"
      aria-live="polite"
    >
      <div className={styles.panelBody}>
        <div className={`${styles.notice} ${styles.noticeError}`}>
          <p className={styles.noticeTitle}>Couldn’t interpret that</p>
          <p className={styles.noticeMsg}>{props.error.message}</p>
          {props.error.hint && <p className={styles.noticeHint}>{props.error.hint}</p>}
        </div>
      </div>
    </section>
  );
}
