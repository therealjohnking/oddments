'use client';

import type { TableLayout } from '@/lib/pastewright';
import styles from './pastewright.module.css';

const OPTIONS: { id: TableLayout; label: string; hint: string }[] = [
  { id: 'auto', label: 'Auto', hint: 'Choose per table' },
  { id: 'aligned', label: 'Aligned columns', hint: 'Monospace grid' },
  { id: 'records', label: 'Records', hint: 'One block per row' },
];

interface Props {
  value: TableLayout;
  onChange: (value: TableLayout) => void;
}

export function TableLayoutControl({ value, onChange }: Props) {
  return (
    <div className={styles.tableControl}>
      <span className={styles.fieldLabel} id="pw-table-layout-label">
        Table layout
      </span>
      <div className={styles.segmented} role="radiogroup" aria-labelledby="pw-table-layout-label">
        {OPTIONS.map((option) => {
          const active = option.id === value;
          return (
            <label
              key={option.id}
              className={styles.segment}
              data-selected={active}
              title={option.hint}
            >
              <input
                type="radio"
                name="pw-table-layout"
                className="visually-hidden"
                aria-label={`${option.label} — ${option.hint}`}
                checked={active}
                onChange={() => onChange(option.id)}
              />
              {option.label}
            </label>
          );
        })}
      </div>
    </div>
  );
}
