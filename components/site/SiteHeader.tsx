import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle';
import styles from './site.module.css';

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`container ${styles.headerInner}`}>
        <Link href="/" className={styles.wordmark}>
          <span className={styles.mark} aria-hidden="true">
            o
          </span>
          <span className={styles.wordmarkText}>oddments</span>
        </Link>
        <nav className={styles.nav} aria-label="Site">
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
