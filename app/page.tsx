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

        <Link className={styles.card} href="/tools/csv-autopsy">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>CSV Autopsy</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A local-first CSV profiler and diagnostic instrument. Drop in a file and see its
            structure, inferred types, and candidate keys — plus duplicates, type anomalies,
            whitespace, and capitalization drift, each with a plain-language reason. Inspect first,
            fix deliberately.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>data quality</li>
            <li className={styles.tag}>type inference</li>
            <li className={styles.tag}>candidate keys</li>
            <li className={styles.tag}>local-only</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/diffoscope">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Diffoscope</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A human-oriented text comparison instrument. Paste two versions and see exactly what
            changed &mdash; by word, character, or line &mdash; including the differences your eyes
            slide past: whitespace, invisible characters, curly-vs-straight punctuation, and
            Unicode-normalization quirks. It explains what looks identical but isn&rsquo;t.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>word / char / line</li>
            <li className={styles.tag}>invisible diffs</li>
            <li className={styles.tag}>unicode-aware</li>
            <li className={styles.tag}>unified diff</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/json-crime-scene">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>JSON Crime Scene</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A local-first instrument for understanding one JSON document. Paste or drop it and get a
            structural profile, an explorable tree with exact paths, and diagnostic findings &mdash;
            duplicate keys that <code>JSON.parse</code> hides, inconsistent object shapes, mixed
            types, and integers that quietly lose precision. It answers &ldquo;what am I looking
            at?&rdquo;
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>tree explorer</li>
            <li className={styles.tag}>duplicate keys</li>
            <li className={styles.tag}>JSON Pointer</li>
            <li className={styles.tag}>safe-integer</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/corporate-bingo">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Corporate Phrase Bingo</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A bingo card for surviving meetings one cliché at a time. Deal a randomized 5&times;5
            card of corporate phrases, tap them as you hear them, and win on rows, columns, or
            diagonals. Customize the deck and keep your card between sessions. Turn strategic
            alignment into a competitive event.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>meeting survival</li>
            <li className={styles.tag}>5&times;5 card</li>
            <li className={styles.tag}>custom deck</li>
            <li className={styles.tag}>local-only</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/date-goblin">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Date Goblin</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A local-first date/time interpreter. Paste an ISO timestamp, Unix time, wall-clock time,
            or Excel serial and see what it actually means &mdash; an exact instant or a local time
            still needing a zone &mdash; with UTC and zone offsets, Unix seconds vs. milliseconds,
            ISO week numbers, and the DST folds and gaps most tools quietly paper over. It makes the
            temporal nonsense legible.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>instant vs. local</li>
            <li className={styles.tag}>DST folds &amp; gaps</li>
            <li className={styles.tag}>unix &amp; excel</li>
            <li className={styles.tag}>IANA zones</li>
          </ul>
        </Link>

        <Link className={styles.card} href="/tools/regex-workbench">
          <span className={styles.cardTop}>
            <span className={styles.cardTitle}>Regex Workbench</span>
            <span className={styles.cardArrow} aria-hidden="true">
              →
            </span>
          </span>
          <span className={styles.cardDesc}>
            A local-first instrument for JavaScript regular expressions. Enter a pattern and see
            exactly what it does &mdash; matches highlighted in place, every capture group, exact
            positions, zero-width behaviour made visible, a deterministic explanation built from the
            parse tree, and a replacement preview. Matching runs off the main thread with a safety
            timeout. It exposes the engine rather than hiding it.
          </span>
          <ul className={styles.tags}>
            <li className={styles.tag}>capture groups</li>
            <li className={styles.tag}>zero-width</li>
            <li className={styles.tag}>explain &amp; replace</li>
            <li className={styles.tag}>ECMAScript</li>
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
