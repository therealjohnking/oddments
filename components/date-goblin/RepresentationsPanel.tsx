'use client';

import type { Interpretation } from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

type Ok = Extract<Interpretation, { status: 'ok' }>;

interface Props {
  interp: Ok;
  onCopy: (text: string, label: string) => void;
  onCopySummary: () => void;
}

function Rep({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className={styles.rep}>
      <span className={styles.repMain}>
        <span className={styles.repLabel}>{label}</span>
        <span className={styles.repValue}>{value}</span>
      </span>
      <button
        type="button"
        className={styles.copyBtn}
        onClick={() => onCopy(value, label)}
        aria-label={`Copy ${label}`}
      >
        Copy
      </button>
    </div>
  );
}

export function RepresentationsPanel({ interp, onCopy, onCopySummary }: Props) {
  const primary = interp.zones.find((z) => z.roles.includes('primary')) ?? interp.zones[0];

  return (
    <section className={styles.panel} aria-label="Representations">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Canonical representations</h2>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnGhost}`}
          onClick={onCopySummary}
        >
          Copy summary
        </button>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.reps}>
          <Rep label="ISO 8601 (UTC)" value={interp.instant.iso} onCopy={onCopy} />
          {primary && primary.reading.zoneId !== 'UTC' && (
            <Rep
              label={`ISO 8601 (${primary.reading.zoneId})`}
              value={primary.reading.iso}
              onCopy={onCopy}
            />
          )}
          <Rep label="Unix seconds" value={interp.epochSecondsText} onCopy={onCopy} />
          <Rep
            label="Unix milliseconds"
            value={String(interp.instant.epochMilliseconds)}
            onCopy={onCopy}
          />
          <Rep
            label="Epoch nanoseconds"
            value={interp.instant.epochNanoseconds.toString()}
            onCopy={onCopy}
          />
        </div>
        <p className={styles.rangeNote}>
          {interp.range.fitsJsDate
            ? 'Fits a JavaScript Date (milliseconds since the epoch, ±10⁸ days).'
            : 'Outside the JavaScript Date / Temporal.Instant range (±10⁸ days) — representations may be approximate.'}
        </p>
      </div>
    </section>
  );
}
