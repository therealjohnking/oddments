import styles from './site.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p className={styles.footerNote}>
          Everything runs locally in your browser. No account, no uploads, no database — your text
          never leaves the page.
        </p>
        <span className={styles.footerTag}>oddments · small instruments</span>
      </div>
    </footer>
  );
}
