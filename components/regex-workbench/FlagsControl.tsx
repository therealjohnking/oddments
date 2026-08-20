'use client';

import { flagList, type FlagId } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  flags: string;
  onToggle: (id: FlagId) => void;
}

const FLAGS = flagList();

export function FlagsControl({ flags, onToggle }: Props) {
  const unsupported = FLAGS.filter((f) => !f.supported);
  return (
    <div role="group" aria-label="Regex flags">
      <span className={styles.fieldLabel}>Flags</span>
      <div className={styles.flagsRow}>
        {FLAGS.map((flag) => {
          const active = flags.includes(flag.id);
          return (
            <button
              key={flag.id}
              type="button"
              className={styles.flagChip}
              aria-pressed={active}
              disabled={!flag.supported}
              onClick={() => onToggle(flag.id)}
              title={`${flag.id} — ${flag.name}: ${flag.summary}${
                flag.supported ? '' : ' (not supported in this browser)'
              }`}
            >
              <span className={styles.flagLetter}>{flag.id}</span>
              <span className={styles.flagName}>{flag.name}</span>
            </button>
          );
        })}
      </div>
      {unsupported.length > 0 && (
        <p className={styles.flagUnsupported}>
          Not available in this browser: {unsupported.map((f) => f.id).join(', ')}.
        </p>
      )}
    </div>
  );
}
