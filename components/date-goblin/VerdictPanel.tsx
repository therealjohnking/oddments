'use client';

import {
  type FoldChoice,
  type GapChoice,
  type Interpretation,
  relativeTime,
} from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

type Ok = Extract<Interpretation, { status: 'ok' }>;

interface Props {
  interp: Ok;
  nowMs: number | null;
  onFoldChoice: (choice: FoldChoice) => void;
  onGapChoice: (choice: GapChoice) => void;
}

function DstOption({
  name,
  selected,
  onSelect,
  label,
  value,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
  label: string;
  value: string;
}) {
  return (
    <label className={styles.dstOption} data-selected={selected}>
      <input type="radio" name={name} checked={selected} onChange={onSelect} />
      <span className={styles.dstOptionBody}>
        <span className={styles.dstOptionLabel}>{label}</span>
        <span className={styles.dstOptionValue}>{value}</span>
      </span>
    </label>
  );
}

export function VerdictPanel({ interp, nowMs, onFoldChoice, onGapChoice }: Props) {
  const primary = interp.zones.find((z) => z.roles.includes('primary')) ?? interp.zones[0];
  const rel = nowMs != null ? relativeTime(interp.instant, nowMs) : null;
  const isInstant = interp.sourceKind === 'instant';

  return (
    <section className={styles.panel} aria-label="Interpretation">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Interpretation</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.verdict}>
          <span
            className={`${styles.kindBadge} ${isInstant ? styles.kindInstant : styles.kindLocal}`}
          >
            {isInstant ? '◎ Instant' : '◷ Local wall time'}
          </span>
          <p className={styles.recognized}>{interp.recognition.summary}</p>

          <div>
            <p className={styles.primaryInstant}>{interp.instant.iso}</p>
            {primary && (
              <p className={styles.primaryZoneLine}>
                {primary.reading.label} ({primary.reading.offset}
                {primary.reading.abbreviation ? ` · ${primary.reading.abbreviation}` : ''}) in{' '}
                {interp.primaryZone}
                {rel && <span className={styles.relative}> — {rel.text}</span>}
              </p>
            )}
          </div>

          {interp.resolution?.kind === 'ambiguous' && (
            <div className={styles.dst}>
              <p className={styles.dstTitle}>Ambiguous local time — this reading occurs twice</p>
              <p className={styles.dstDetail}>
                Clocks fall back {interp.resolution.shiftMinutes} minutes in {interp.primaryZone} on
                this date, so this wall-clock time happens twice. Choose which instant you mean.
              </p>
              <div className={styles.dstOptions} role="radiogroup" aria-label="Which occurrence">
                <DstOption
                  name="dg-fold"
                  selected={interp.chosen !== 'later'}
                  onSelect={() => onFoldChoice('earlier')}
                  label={`First — ${interp.resolution.earlier.reading.offset}${interp.resolution.earlier.reading.abbreviation ? ` (${interp.resolution.earlier.reading.abbreviation})` : ''}`}
                  value={interp.resolution.earlier.instant.iso}
                />
                <DstOption
                  name="dg-fold"
                  selected={interp.chosen === 'later'}
                  onSelect={() => onFoldChoice('later')}
                  label={`Second — ${interp.resolution.later.reading.offset}${interp.resolution.later.reading.abbreviation ? ` (${interp.resolution.later.reading.abbreviation})` : ''}`}
                  value={interp.resolution.later.instant.iso}
                />
              </div>
            </div>
          )}

          {interp.resolution?.kind === 'gap' && (
            <div className={styles.dst}>
              <p className={styles.dstTitle}>Nonexistent local time — this reading was skipped</p>
              <p className={styles.dstDetail}>
                Clocks jumped {interp.resolution.gapStartLabel} → {interp.resolution.gapEndLabel} (
                {interp.resolution.gapMinutes} minutes) in {interp.primaryZone}, so this wall-clock
                time never happens. The two nearest real readings are:
              </p>
              <div className={styles.dstOptions} role="radiogroup" aria-label="Nearest real time">
                <DstOption
                  name="dg-gap"
                  selected={interp.chosen === 'before'}
                  onSelect={() => onGapChoice('before')}
                  label={`Before the gap — ${interp.resolution.before.reading.wall.iso.slice(11, 16)} ${interp.resolution.before.reading.offset}`}
                  value={interp.resolution.before.instant.iso}
                />
                <DstOption
                  name="dg-gap"
                  selected={interp.chosen !== 'before'}
                  onSelect={() => onGapChoice('after')}
                  label={`After the gap — ${interp.resolution.after.reading.wall.iso.slice(11, 16)} ${interp.resolution.after.reading.offset}`}
                  value={interp.resolution.after.instant.iso}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
