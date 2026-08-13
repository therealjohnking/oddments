import { BANDS } from '@/lib/slopometer';
import styles from './slopometer.module.css';

interface Props {
  onExample: () => void;
}

export function EmptyState({ onExample }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Nothing to weigh yet</h2>
      <p className={styles.emptyText}>
        Paste a blog post, a product announcement, a LinkedIn update, or that paragraph you keep
        rewriting. Slopometer scans for stylistic tells — canned openers, contrast templates,
        corporate jargon, dramatic one-line paragraphs, em-dash habits — and shows you exactly which
        ones it found and what each one added to the score.
      </p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onExample}>
        Try an example
      </button>
      <div className={styles.bandLegend} aria-hidden="true">
        {BANDS.map((band) => (
          <span key={band.id} className={styles.bandLegendRow}>
            <span className={styles.bandDot} data-band={band.id} />
            <span className={styles.bandLegendRange}>
              {band.min}–{band.max}
            </span>
            {band.label}
          </span>
        ))}
      </div>
    </div>
  );
}
