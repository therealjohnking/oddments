'use client';

import { useId, useState } from 'react';
import { isValidZone } from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

interface Props {
  value: string;
  onChange: (zone: string) => void;
  label: string;
  /** The datalist options (gated until hydration to avoid SSR mismatch). */
  zones: string[];
  /** Optional secondary line under the label (e.g. offset chip). */
  hint?: string;
}

/**
 * A native, accessible searchable zone picker: an `<input>` backed by a
 * `<datalist>`. Typing filters the IANA list; picking or typing a valid zone
 * commits it; an invalid value reverts on blur. No fragile custom combobox.
 */
export function ZonePicker({ value, onChange, label, zones, hint }: Props) {
  const [text, setText] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  const listId = useId();

  // Resync the editable text when the committed `value` changes (e.g. loading an
  // example) using React's adjust-state-during-render pattern — not an effect.
  if (value !== prevValue) {
    setPrevValue(value);
    setText(value);
  }

  const handleChange = (next: string) => {
    setText(next);
    if (isValidZone(next)) onChange(next);
  };

  const handleBlur = () => {
    if (isValidZone(text)) onChange(text);
    else setText(value);
  };

  return (
    <label className={styles.zoneField}>
      <span className={styles.controlLabel}>{label}</span>
      <input
        className={styles.zoneInput}
        type="text"
        value={text}
        list={listId}
        onChange={(event) => handleChange(event.target.value)}
        onBlur={handleBlur}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        autoComplete="off"
        inputMode="text"
        aria-label={label}
      />
      <datalist id={listId}>
        {zones.map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
      {hint && <span className={styles.zoneRole}>{hint}</span>}
    </label>
  );
}
