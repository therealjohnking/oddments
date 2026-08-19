'use client';

import styles from './date-goblin.module.css';

export function EmptyState() {
  return (
    <section className={styles.panel} aria-label="Getting started">
      <div className={styles.panelBody}>
        <div className={styles.empty}>
          <p className={styles.emptyLede}>
            Paste a date, time, or timestamp above. Date Goblin recognizes it, tells you whether it
            is an <strong>exact instant</strong> or a <strong>local wall-clock time</strong>, and
            shows the representations that actually matter.
          </p>
          <ul className={styles.emptyList}>
            <li>
              <code>2026-08-17T16:24:00-04:00</code> — an instant with an explicit offset
            </li>
            <li>
              <code>1786998240</code> — a Unix timestamp (seconds or milliseconds)
            </li>
            <li>
              <code>2026-11-01 01:30</code> in <code>America/New_York</code> — a clock reading that
              happens twice
            </li>
            <li>
              <code>2026-03-08 02:30</code> — a clock reading that never happens
            </li>
            <li>
              <code>60</code> as an Excel serial — the date Excel invented
            </li>
          </ul>
          <p className={styles.engineNote}>
            All interpretation runs locally in your browser using the standards-based Temporal API.
            No network, no location access, nothing stored but your preferences.
          </p>
        </div>
      </div>
    </section>
  );
}
