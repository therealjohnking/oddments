import Link from 'next/link';
import { FEEDBACK_URL, GITHUB_URL, pageMetadata } from '@/lib/site/meta';
import styles from '../info-page.module.css';

export const metadata = pageMetadata({
  name: 'About',
  description:
    'What Oddments is: a collection of small browser tools, and a laboratory where each one is built far enough to find out whether it deserves to become something larger.',
  path: '/about',
});

export default function AboutPage() {
  return (
    <div className="container">
      <article className={styles.page}>
        <p className={styles.breadcrumb}>
          <Link href="/">oddments</Link> / about
        </p>
        <h1 className={styles.title}>About Oddments</h1>
        <p className={styles.lede}>
          Oddments is a collection of small browser tools. Each one takes on one annoying little
          problem — invisible characters, a suspicious CSV, a timestamp of unclear intent.
        </p>

        <section className={styles.section}>
          <h2>Small instruments</h2>
          <p>
            Every tool follows the same bias: do one job, do it exactly, and say honestly what was
            and wasn&rsquo;t done. None of them fake intelligence, certainty, or precision. When a
            tool can&rsquo;t know something — whether a regex is &ldquo;safe&rdquo;, which zone a
            bare wall-clock time meant — it says so instead of guessing.
          </p>
        </section>

        <section className={styles.section}>
          <h2>A laboratory</h2>
          <p>
            Oddments is also a workshop in the working sense: a place where a small software idea is
            built far enough to find out whether it deserves to become something larger. Some
            instruments will stay this size forever — that&rsquo;s a fine outcome. Some will keep
            improving as real use teaches us what they should be. Either way, nothing here ships as
            a sketch: a tool arrives only when it&rsquo;s genuinely finished.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Local-first, by construction</h2>
          <p>
            Everything runs in your browser. The site is static files — no server logic, no account,
            no database — so what you paste into a tool is processed on your machine and never
            uploaded. The specifics are on the <Link href="/privacy">privacy page</Link>.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Help the lab learn</h2>
          <p>
            The instruments improve when people report what actually happened: a file that confused
            CSV Autopsy, a destination that mangled a Pastewright table, a thing you wish a tool
            did. Feedback lives in <a href={FEEDBACK_URL}>GitHub Issues</a>, and the{' '}
            <a href={GITHUB_URL}>source is public</a>.
          </p>
        </section>
      </article>
    </div>
  );
}
