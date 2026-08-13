import { useMemo } from 'react';
import {
  TRANSFORM_LIST,
  applyTransforms,
  type TransformId,
  type TransformRisk,
} from '@/lib/inspector';
import styles from './inspector.module.css';

const RISKS: { risk: TransformRisk; label: string }[] = [
  { risk: 'safe', label: 'Safe' },
  { risk: 'moderate', label: 'Optional' },
  { risk: 'destructive', label: 'Destructive — read before enabling' },
];

interface Props {
  input: string;
  deferredInput: string;
  enabled: Set<TransformId>;
  onToggle: (id: TransformId) => void;
  onCopyText: (text: string, successMessage: string) => void;
}

export function CleanPanel({ input, deferredInput, enabled, onToggle, onCopyText }: Props) {
  const preview = useMemo(() => applyTransforms(deferredInput, enabled), [deferredInput, enabled]);

  const deltaNote = !preview.changed
    ? 'No changes with the current settings.'
    : preview.codePointDelta < 0
      ? `${(-preview.codePointDelta).toLocaleString()} characters removed.`
      : preview.codePointDelta > 0
        ? `${preview.codePointDelta.toLocaleString()} characters added.`
        : 'Characters replaced (length unchanged).';

  const copyCleaned = () => {
    const result = applyTransforms(input, enabled);
    const note = result.changed
      ? result.codePointDelta < 0
        ? ` (${-result.codePointDelta} removed)`
        : result.codePointDelta > 0
          ? ` (${result.codePointDelta} added)`
          : ' (characters replaced)'
      : ' (no changes)';
    onCopyText(result.text, `Cleaned text copied to the clipboard${note}.`);
  };

  return (
    <section className={styles.panel} aria-label="Clean">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Clean</h2>
      </div>

      <div className={styles.panelBody}>
        <p className={styles.help} style={{ marginTop: 0 }}>
          Cleaning is opt-in and conservative. Only the two safe transforms are on by default;
          everything else is off until you choose it, and each shows how many characters it would
          affect.
        </p>

        {RISKS.map(({ risk, label }) => {
          const transforms = TRANSFORM_LIST.filter((t) => t.risk === risk);
          return (
            <div className={styles.riskGroup} key={risk}>
              <p className={styles.riskLabel}>
                <span className={styles.riskDot} data-risk={risk} aria-hidden="true" />
                {label}
              </p>
              {transforms.map((transform) => {
                const on = enabled.has(transform.id);
                const count = transform.count(deferredInput);
                return (
                  <div
                    className={styles.transform}
                    key={transform.id}
                    data-on={on}
                    data-risk={risk}
                  >
                    <input
                      type="checkbox"
                      id={`t-${transform.id}`}
                      className={styles.transformCheck}
                      checked={on}
                      onChange={() => onToggle(transform.id)}
                      aria-describedby={`t-${transform.id}-desc`}
                    />
                    <div className={styles.transformBody}>
                      <label htmlFor={`t-${transform.id}`} className={styles.transformLabel}>
                        {transform.label}
                        <span className={styles.transformCountBadge} data-zero={count === 0}>
                          {count.toLocaleString()}
                        </span>
                      </label>
                      <p id={`t-${transform.id}-desc`} className={styles.transformDesc}>
                        {transform.description}
                      </p>
                      {transform.caution && <p className={styles.caution}>⚠ {transform.caution}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}

        <details className={styles.cleanPreview}>
          <summary>Preview cleaned output</summary>
          <div className={styles.previewBox}>{preview.text === '' ? '(empty)' : preview.text}</div>
        </details>

        <div className={styles.cleanActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={copyCleaned}
            disabled={input.length === 0}
          >
            Copy cleaned text
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() => onCopyText(input, 'Original text copied to the clipboard.')}
            disabled={input.length === 0}
          >
            Copy original
          </button>
          <span className={styles.deltaNote}>{deltaNote}</span>
        </div>
      </div>
    </section>
  );
}
