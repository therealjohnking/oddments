import { EXAMPLES } from '@/lib/diffoscope';
import styles from './diffoscope.module.css';

interface Props {
  onExample: (id: string) => void;
}

/** Shown before there is anything to compare. */
export function EmptyState({ onExample }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Compare two pieces of text</h2>
      <p className={styles.emptyText}>
        Paste an original into <strong>A / Before</strong> and a revision into{' '}
        <strong>B / After</strong> to see exactly what changed — words, characters, or lines — plus
        the differences your eyes slide past: whitespace, invisible characters, look-alike
        punctuation, and Unicode quirks. Or start from an example:
      </p>
      <div className={styles.exampleGrid}>
        {EXAMPLES.map((example) => (
          <button
            key={example.id}
            type="button"
            className={styles.exampleCard}
            onClick={() => onExample(example.id)}
          >
            <span className={styles.exampleCardTitle}>{example.label}</span>
            <span className={styles.exampleCardText}>{example.description}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
