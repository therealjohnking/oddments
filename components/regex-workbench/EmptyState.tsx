import styles from './regex-workbench.module.css';

export function EmptyState() {
  return (
    <section className={styles.panel} aria-label="Getting started">
      <div className={styles.panelBody}>
        <div className={styles.empty}>
          <p className={styles.emptyLede}>
            Enter a pattern and some test text and the workbench comes alive — matches, capture
            groups, exact positions, a plain-language breakdown of the pattern, and a replacement
            preview, all updating as you type.
          </p>
          <ul className={styles.emptyList}>
            <li>
              See <strong>what matched</strong> — highlighted in place, with a match navigator and
              exact UTF-16 and line/column positions.
            </li>
            <li>
              See <strong>why it matched</strong> — every capture group, named or numbered, with the
              difference between an <em>unmatched</em> group and one that captured empty text.
            </li>
            <li>
              See <strong>what the engine interpreted</strong> — a deterministic, structural
              explanation of the pattern, derived from its parse tree, not guessed.
            </li>
            <li>
              Try the <code>Named groups</code> or <code>Backtracking trap</code> example below to
              see the instrument fully assembled.
            </li>
          </ul>
          <p className={styles.engineNote}>
            Regex syntax varies by engine. This workbench uses JavaScript&rsquo;s{' '}
            <code>RegExp</code> — nothing you enter leaves your browser.
          </p>
        </div>
      </div>
    </section>
  );
}
