import styles from './csv-autopsy.module.css';

interface Props {
  onSample: () => void;
}

const CARDS = [
  {
    title: 'Structure & types',
    text: 'Delimiter, header, row and column counts, and a conservative type per column — with the values that do not fit.',
  },
  {
    title: 'Quality problems',
    text: 'Duplicate rows, duplicated identifiers, mixed types, whitespace, capitalization drift, and null-like tokens.',
  },
  {
    title: 'Candidate keys',
    text: 'Columns that look like record identifiers — and the ones that should be unique but are not.',
  },
  {
    title: 'A report, not a rewrite',
    text: 'Export the findings as Markdown or JSON. CSV Autopsy never modifies or re-downloads your data.',
  },
];

export function EmptyState({ onSample }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Nothing on the table yet</h2>
      <p className={styles.emptyText}>
        Drop a CSV file above, choose one from your computer, or paste CSV text. CSV Autopsy reads
        it locally and tells you what is in it — structure, inferred types, and anything that looks
        suspicious — within a second or two.
      </p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSample}>
        Explore the sample dataset
      </button>
      <div className={styles.emptyGrid}>
        {CARDS.map((card) => (
          <div className={styles.emptyCard} key={card.title}>
            <p className={styles.emptyCardTitle}>{card.title}</p>
            <p className={styles.emptyCardText}>{card.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
