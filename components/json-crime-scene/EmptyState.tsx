import styles from './jcs.module.css';

interface Props {
  onSample: () => void;
}

const CARDS: { title: string; text: string }[] = [
  {
    title: 'Structural profile',
    text: 'Root type, value counts, property counts, nesting depth, and the biggest things in the document.',
  },
  {
    title: 'Tree explorer',
    text: 'Expand and collapse objects and arrays, inspect any node, and copy its JSON Pointer or path.',
  },
  {
    title: 'Duplicate keys',
    text: 'The one thing JSON.parse silently throws away — surfaced from the source, with positions.',
  },
  {
    title: 'Shape & type checks',
    text: 'Where objects in an array disagree, a field changes type, or a number exceeds the safe range.',
  },
];

export function EmptyState({ onSample }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>What am I looking at?</h2>
      <p className={styles.emptyText}>
        Paste JSON, drop a <code>.json</code> file, or load the sample. JSON Crime Scene tells you
        what is actually in it, how it is structured, and what looks worth investigating — entirely
        in your browser.
      </p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onSample}>
        Load sample
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
