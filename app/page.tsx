import Link from 'next/link';
import styles from './page.module.css';

export default function HomePage() {
  return (
    <div className="container">
      <section className={styles.hero}>
        <p className={styles.eyebrow}>a workshop of small, precise tools</p>
        <h1 className={styles.title}>Oddments</h1>
        <p className={styles.tagline}>Small instruments, finished properly.</p>
        <p className={styles.lede}>
          Useful, occasionally strange, always deliberately made — tools for text, code, and the
          web&rsquo;s odder corners. Each one is small enough to open without a manual and finished
          enough to bookmark. Nothing to install, no account to make; it all runs in your browser.
        </p>
      </section>

      <section className={styles.tools} aria-labelledby="tools-heading">
        <h2 id="tools-heading" className={styles.toolsHeading}>
          Available now
        </h2>
        <Link className={styles.card} href="/tools/invisible-characters">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Invisible Character Inspector</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            Paste any text to reveal the characters you can&rsquo;t see: zero-width spaces, curly
            quotes, non-breaking spaces, bidirectional tricks, and more — with exact positions,
            code-point details, and conservative one-click clean-up.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>zero-width</li>
            <li className={styles.tag}>homoglyphs</li>
            <li className={styles.tag}>whitespace</li>
            <li className={styles.tag}>bidi / trojan-source</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/slopometer">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Slopometer</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A deterministic prose-style analyzer. Paste writing and it scores the stylistic tics
            that read as generic, over-polished, or performative — canned openers, contrast
            templates, corporate jargon, em-dash habits — and shows exactly which rules fired.
            Detects writing crimes, not AI.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>style linter</li>
            <li className={styles.tag}>clichés</li>
            <li className={styles.tag}>jargon</li>
            <li className={styles.tag}>explainable</li>
          </ul>
        </Link>

        <p className={styles.note}>
          More instruments are on the bench. Each one arrives only when it&rsquo;s genuinely
          finished — not before.
        </p>
      </section>
    </div>
  );
}
