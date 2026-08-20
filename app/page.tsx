import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE } from '@/lib/site/meta';
import styles from './page.module.css';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: '/',
    siteName: SITE_NAME,
    type: 'website',
  },
};

/**
 * One landing-page card. The link's accessible name is just the tool name
 * (aria-labelledby) — not the whole card's prose — so screen-reader link
 * lists stay scannable; the description is still announced via
 * aria-describedby, and browse mode reads the card as laid out.
 */
function ToolCard({
  slug,
  name,
  tags,
  children,
}: {
  slug: string;
  name: string;
  tags: React.ReactNode[];
  children: React.ReactNode;
}) {
  const titleId = `card-${slug}-title`;
  const descId = `card-${slug}-desc`;
  return (
    <Link
      className={styles.card}
      href={`/tools/${slug}` as Route}
      aria-labelledby={titleId}
      aria-describedby={descId}
    >
      <span className={styles.cardTop}>
        <span id={titleId} className={styles.cardTitle}>
          {name}
        </span>
        <span className={styles.cardArrow} aria-hidden="true">
          →
        </span>
      </span>
      <span id={descId} className={styles.cardDesc}>
        {children}
      </span>
      <ul className={styles.tags}>
        {tags.map((tag, i) => (
          <li key={i} className={styles.tag}>
            {tag}
          </li>
        ))}
      </ul>
    </Link>
  );
}

// Cards are ordered newest-first — the same order as lib/site/tools.ts, which
// a test enforces. The copy lives here as JSX, not in the manifest, because
// it's real prose with markup, and this page is where it's read.
export default function HomePage() {
  return (
    <div className="container">
      <section className={styles.hero}>
        <p className={styles.eyebrow}>a workshop of small, precise tools</p>
        <h1 className={styles.title}>Oddments</h1>
        <p className={styles.tagline}>Small instruments for annoying little problems.</p>
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
        <div className={styles.grid}>
          <ToolCard
            slug="pastewright"
            name="Pastewright"
            tags={[
              <>markdown &rarr; anywhere</>,
              'table adapter',
              'rich clipboard',
              'what changed',
            ]}
          >
            Markdown is great until you need to put it somewhere that isn&rsquo;t. Paste Markdown,
            choose the destination &mdash; rich text for email and documents, LinkedIn, Slack,
            Reddit Markdown, or plain text &mdash; and copy a version adapted for it. Tables become
            real HTML tables, aligned columns, or record blocks as needed. It transforms
            representation, not your words, and shows you exactly what changed.
          </ToolCard>

          <ToolCard
            slug="regex-workbench"
            name="Regex Workbench"
            tags={['capture groups', 'zero-width', <>explain &amp; replace</>, 'ECMAScript']}
          >
            A local-first instrument for JavaScript regular expressions. Enter a pattern and see
            exactly what it does &mdash; matches highlighted in place, every capture group, exact
            positions, zero-width behaviour made visible, a deterministic explanation built from the
            parse tree, and a replacement preview. Matching runs off the main thread with a safety
            timeout. It exposes the engine rather than hiding it.
          </ToolCard>

          <ToolCard
            slug="date-goblin"
            name="Date Goblin"
            tags={[
              'instant vs. local',
              <>DST folds &amp; gaps</>,
              <>unix &amp; excel</>,
              'IANA zones',
            ]}
          >
            A local-first date/time interpreter. Paste an ISO timestamp, Unix time, wall-clock time,
            or Excel serial and see what it actually means &mdash; an exact instant or a local time
            still needing a zone &mdash; with UTC and zone offsets, Unix seconds vs. milliseconds,
            ISO week numbers, and the DST folds and gaps most tools quietly paper over. It makes the
            temporal nonsense legible.
          </ToolCard>

          <ToolCard
            slug="corporate-bingo"
            name="Corporate Phrase Bingo"
            tags={['meeting survival', <>5&times;5 card</>, 'custom deck', 'local-only']}
          >
            A bingo card for surviving meetings one cliché at a time. Deal a randomized 5&times;5
            card of corporate phrases, tap them as you hear them, and win on rows, columns, or
            diagonals. Customize the deck and keep your card between sessions. Turn strategic
            alignment into a competitive event.
          </ToolCard>

          <ToolCard
            slug="json-crime-scene"
            name="JSON Crime Scene"
            tags={['tree explorer', 'duplicate keys', 'JSON Pointer', 'safe-integer']}
          >
            A local-first instrument for understanding one JSON document. Paste or drop it and get a
            structural profile, an explorable tree with exact paths, and diagnostic findings &mdash;
            duplicate keys that <code>JSON.parse</code> hides, inconsistent object shapes, mixed
            types, and integers that quietly lose precision. It answers &ldquo;what am I looking
            at?&rdquo;
          </ToolCard>

          <ToolCard
            slug="diffoscope"
            name="Diffoscope"
            tags={['word / char / line', 'invisible diffs', 'unicode-aware', 'unified diff']}
          >
            A human-oriented text comparison instrument. Paste two versions and see exactly what
            changed &mdash; by word, character, or line &mdash; including the differences your eyes
            slide past: whitespace, invisible characters, curly-vs-straight punctuation, and
            Unicode-normalization quirks. It explains what looks identical but isn&rsquo;t.
          </ToolCard>

          <ToolCard
            slug="csv-autopsy"
            name="CSV Autopsy"
            tags={['data quality', 'type inference', 'candidate keys', 'local-only']}
          >
            A local-first CSV profiler and diagnostic instrument. Drop in a file and see its
            structure, inferred types, and candidate keys &mdash; plus duplicates, type anomalies,
            whitespace, and capitalization drift, each with a plain-language reason. Inspect first,
            fix deliberately.
          </ToolCard>

          <ToolCard
            slug="slopometer"
            name="Slopometer"
            tags={['style linter', 'clichés', 'jargon', 'explainable']}
          >
            A deterministic prose-style analyzer. Paste writing and it scores the stylistic tics
            that read as generic, over-polished, or performative &mdash; canned openers, contrast
            templates, corporate jargon, em-dash habits &mdash; and shows exactly which rules fired.
            Detects writing crimes, not AI.
          </ToolCard>

          <ToolCard
            slug="invisible-characters"
            name="Invisible Character Inspector"
            tags={['zero-width', 'homoglyphs', 'whitespace', 'bidi / trojan-source']}
          >
            Paste any text to reveal the characters you can&rsquo;t see: zero-width spaces, curly
            quotes, non-breaking spaces, bidirectional tricks, and more &mdash; with exact
            positions, code-point details, and conservative one-click clean-up.
          </ToolCard>
        </div>

        <p className={styles.note}>
          More instruments are on the bench. Oddments is a small laboratory: each tool is built far
          enough to find out whether it deserves to become something larger, and it arrives only
          when it&rsquo;s genuinely finished — not before.{' '}
          <Link href="/about">More about the lab</Link>.
        </p>
      </section>
    </div>
  );
}
