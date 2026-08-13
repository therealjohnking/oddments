import styles from './inspector.module.css';

interface Props {
  onExample: () => void;
}

const LEGEND: { abbr: string; sev: string; label: string }[] = [
  { abbr: 'NBSP', sev: 'warning', label: 'no-break space' },
  { abbr: 'ZWSP', sev: 'warning', label: 'zero-width space' },
  { abbr: 'RLO', sev: 'danger', label: 'bidi override' },
  { abbr: '→', sev: 'info', label: 'tab' },
];

export function EmptyState({ onExample }: Props) {
  return (
    <div className={styles.empty}>
      <h2 className={styles.emptyTitle}>Nothing to inspect yet</h2>
      <p className={styles.emptyText}>
        Paste text from a PDF, a spreadsheet, a chat app, a password field, or source code, and this
        tool reveals the characters hiding inside it — zero-width spaces, non-breaking spaces, curly
        quotes, homoglyphs, and bidirectional tricks like the &ldquo;Trojan Source&rdquo; attack. It
        reports exactly where each one is, and can conservatively clean them out.
      </p>
      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={onExample}>
        Try an example
      </button>
      <div className={styles.legend} aria-hidden="true">
        {LEGEND.map((item) => (
          <span key={item.abbr} className={styles.legendItem}>
            <span className={styles.chip} data-sev={item.sev}>
              {item.abbr}
            </span>
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
