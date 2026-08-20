import Link from 'next/link';
import { FEEDBACK_URL, pageMetadata } from '@/lib/site/meta';
import styles from '../info-page.module.css';

export const metadata = pageMetadata({
  name: 'Privacy',
  description:
    'What Oddments does with your data, in plain language: tools run entirely in your browser, nothing you paste is uploaded, only settings are stored locally, and analytics — when enabled — counts page views without ever seeing your content.',
  path: '/privacy',
});

export default function PrivacyPage() {
  return (
    <div className="container">
      <article className={styles.page}>
        <p className={styles.breadcrumb}>
          <Link href="/">oddments</Link> / privacy
        </p>
        <h1 className={styles.title}>Privacy</h1>
        <p className={styles.lede}>
          Oddments is built so that it doesn&rsquo;t need your data. This page says exactly what
          happens, in plain language.
        </p>

        <section className={styles.section}>
          <h2>Your content stays in your browser</h2>
          <p>
            Every tool runs entirely on your machine. The text, files, patterns, timestamps, and
            Markdown you put into a tool are processed in the page and never uploaded — the site is
            static files, and the tools have no server to send anything to. That is an architectural
            fact, not just a promise: no Oddments code transmits tool input or output anywhere.
          </p>
        </section>

        <section className={styles.section}>
          <h2>What&rsquo;s stored on your device</h2>
          <p>
            Some tools keep <strong>settings</strong> between visits in your browser&rsquo;s
            localStorage, on your machine. The complete list:
          </p>
          <ul>
            <li>
              <code>oddments-theme</code> — your light/dark choice.
            </li>
            <li>
              <code>oddments-corporate-bingo</code> — your current bingo card, marks, and custom
              phrase deck (the game state is the point of that tool).
            </li>
            <li>
              <code>oddments-date-goblin</code> — display settings and comparison zones. Never the
              date or time you entered.
            </li>
            <li>
              <code>oddments-regex-workbench</code> — the flag toggles. Never the pattern or the
              test text.
            </li>
            <li>
              <code>oddments-pastewright</code> — the chosen destination and table layout. Never
              your Markdown.
            </li>
          </ul>
          <p>Clearing this site&rsquo;s data in your browser removes all of it.</p>
        </section>

        <section className={styles.section}>
          <h2>Cookies</h2>
          <p>The site sets none.</p>
        </section>

        <section className={styles.section}>
          <h2>Analytics</h2>
          <p>
            To learn which tools people actually find useful, the public site may use Cloudflare Web
            Analytics — a cookieless page-view counter. When enabled, it records the page visited,
            the referring site, country, and broad browser and device class. It sets no cookies,
            doesn&rsquo;t follow you across sites, and never includes anything you typed, pasted, or
            dropped into a tool. If analytics ever needs more than that, this page will say so
            first.
          </p>
        </section>

        <section className={styles.section}>
          <h2>The clipboard</h2>
          <p>
            Tools read or write your clipboard only when you press a button that says so
            (&ldquo;Copy&rdquo;, &ldquo;Paste&rdquo;), and your browser may ask permission first.
            Nothing touches the clipboard in the background.
          </p>
        </section>

        <section className={styles.section}>
          <h2>Feedback</h2>
          <p>
            Feedback happens in <a href={FEEDBACK_URL}>GitHub Issues</a>, which is public and
            governed by GitHub&rsquo;s terms — so don&rsquo;t paste sensitive content into an issue.
          </p>
        </section>

        <p className={styles.fineprint}>If any of this changes, this page changes first.</p>
      </article>
    </div>
  );
}
