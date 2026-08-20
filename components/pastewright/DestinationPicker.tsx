'use client';

import { DESTINATIONS, type Destination } from '@/lib/pastewright';
import styles from './pastewright.module.css';

interface Props {
  selected: Destination;
  onSelect: (destination: Destination) => void;
}

export function DestinationPicker({ selected, onSelect }: Props) {
  return (
    <section className={styles.panel} aria-label="Destination">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Destination</h2>
        <span className={styles.panelHint}>Where are you pasting this?</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.destGrid} role="radiogroup" aria-label="Destination">
          {DESTINATIONS.map((destination) => {
            const active = destination.id === selected;
            return (
              <label key={destination.id} className={styles.destOption} data-selected={active}>
                <input
                  type="radio"
                  name="pw-destination"
                  className="visually-hidden"
                  aria-label={`${destination.label} — ${destination.hint}`}
                  checked={active}
                  onChange={() => onSelect(destination.id)}
                />
                <span className={styles.destLabel}>{destination.label}</span>
                <span className={styles.destHint}>{destination.hint}</span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
