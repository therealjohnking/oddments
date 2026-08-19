'use client';

import type {
  DateGoblinExample,
  ExcelSystem,
  InputMode,
  SourceKind,
  UnixUnit,
} from '@/lib/date-goblin';
import { EXAMPLES } from '@/lib/date-goblin';
import { ZonePicker } from './ZonePicker';
import styles from './date-goblin.module.css';

interface Props {
  raw: string;
  onRawChange: (value: string) => void;
  mode: InputMode;
  onModeChange: (mode: InputMode) => void;
  unixUnit: UnixUnit;
  onUnixUnitChange: (unit: UnixUnit) => void;
  excelSystem: ExcelSystem;
  onExcelSystemChange: (system: ExcelSystem) => void;
  zone: string;
  onZoneChange: (zone: string) => void;
  zones: string[];
  sourceKind: SourceKind | null;
  onExample: (example: DateGoblinExample) => void;
  onPaste: () => void;
  onClear: () => void;
}

const MODES: { id: InputMode; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'iso', label: 'ISO / RFC' },
  { id: 'unix', label: 'Unix' },
  { id: 'local', label: 'Local' },
  { id: 'excel', label: 'Excel' },
];

const UNITS: { id: UnixUnit; label: string }[] = [
  { id: 'auto', label: 'Auto' },
  { id: 'seconds', label: 'Seconds' },
  { id: 'milliseconds', label: 'Millis' },
  { id: 'microseconds', label: 'Micros' },
  { id: 'nanoseconds', label: 'Nanos' },
];

export function InputPanel({
  raw,
  onRawChange,
  mode,
  onModeChange,
  unixUnit,
  onUnixUnitChange,
  excelSystem,
  onExcelSystemChange,
  zone,
  onZoneChange,
  zones,
  sourceKind,
  onExample,
  onPaste,
  onClear,
}: Props) {
  const zoneLabel =
    sourceKind === 'local'
      ? 'Interpret wall time in zone'
      : sourceKind === 'instant'
        ? 'View instant in zone'
        : 'Time zone';

  return (
    <section className={styles.panel} aria-label="Input">
      <div className={styles.panelBody}>
        <div className={styles.controlsRow}>
          <div className={styles.controlGroup} role="group" aria-label="Interpretation mode">
            <span className={styles.controlLabel}>Interpret as</span>
            <div className={styles.segmented}>
              {MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={styles.segmentedBtn}
                  aria-pressed={mode === m.id}
                  onClick={() => onModeChange(m.id)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {mode === 'unix' && (
            <div className={styles.controlGroup} role="group" aria-label="Unix unit">
              <span className={styles.controlLabel}>Unit</span>
              <div className={styles.segmented}>
                {UNITS.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    className={styles.segmentedBtn}
                    aria-pressed={unixUnit === u.id}
                    onClick={() => onUnixUnitChange(u.id)}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'excel' && (
            <div className={styles.controlGroup} role="group" aria-label="Excel date system">
              <span className={styles.controlLabel}>Excel system</span>
              <div className={styles.segmented}>
                {(['1900', '1904'] as ExcelSystem[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={styles.segmentedBtn}
                    aria-pressed={excelSystem === s}
                    onClick={() => onExcelSystemChange(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <ZonePicker value={zone} onChange={onZoneChange} label={zoneLabel} zones={zones} />
        </div>

        <label className={styles.field}>
          <span className={styles.fieldLabel}>Date, time, or timestamp</span>
          <textarea
            className={styles.textarea}
            value={raw}
            onChange={(event) => onRawChange(event.target.value)}
            placeholder="2026-08-17T16:24:00-04:00 · 1786998240 · 2026-11-01 01:30"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            rows={2}
            aria-describedby="date-goblin-help"
          />
        </label>

        <div className={styles.toolbar} style={{ marginTop: '0.6rem' }}>
          <button type="button" className={styles.btn} onClick={onPaste}>
            Paste
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onClear}
            disabled={raw.length === 0}
          >
            Clear
          </button>
        </div>

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Examples:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              className={styles.exampleChip}
              onClick={() => onExample(example)}
              title={example.blurb}
            >
              {example.label}
            </button>
          ))}
        </div>

        <p id="date-goblin-help" className={styles.help}>
          Everything runs locally in your browser as you type. Nothing is uploaded, and your entered
          value is never saved.
        </p>
      </div>
    </section>
  );
}
