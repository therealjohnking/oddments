'use client';

import styles from './pastewright.module.css';

export function EmptyState() {
  return (
    <section className={styles.panel} aria-label="How Pastewright works">
      <div className={styles.panelBody}>
        <div className={styles.empty}>
          <p className={styles.emptyLede}>
            Paste Markdown above — from an LLM, a README, or your notes — choose where it&rsquo;s
            going, and copy a version adapted for that destination. Pastewright changes how the text
            is represented, never the words themselves.
          </p>
          <ul className={styles.emptyList}>
            <li>
              <strong>Rich text</strong> — real formatting and HTML tables for email and documents.
            </li>
            <li>
              <strong>LinkedIn</strong> — clean plain text; tables become readable record blocks.
            </li>
            <li>
              <strong>Slack</strong> — pastes predictably; compact tables ride inside a code block.
            </li>
            <li>
              <strong>Reddit Markdown</strong> — keeps Markdown, including tables and fenced code.
            </li>
            <li>
              <strong>Plain text</strong> — deliberately formatted, not merely stripped.
            </li>
          </ul>
          <p className={styles.emptyHintText}>
            Try an example, and watch a single table change completely as you switch destinations.
          </p>
        </div>
      </div>
    </section>
  );
}
