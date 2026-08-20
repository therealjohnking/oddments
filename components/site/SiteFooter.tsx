import Link from 'next/link';
import { FEEDBACK_URL, GITHUB_URL } from '@/lib/site/meta';
import styles from './site.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p className={styles.footerNote}>
          Everything runs locally in your browser. No account, no uploads, no database — your text
          never leaves the page.
        </p>
        <nav className={styles.footerNav} aria-label="Site pages">
          <Link href="/about">About</Link>
          <Link href="/privacy">Privacy</Link>
          <a href={FEEDBACK_URL}>Feedback</a>
          <a href={GITHUB_URL}>Source</a>
        </nav>
        <span className={styles.footerTag}>oddments · small instruments</span>
      </div>
    </footer>
  );
}
