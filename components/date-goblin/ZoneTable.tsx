'use client';

import type { Interpretation } from '@/lib/date-goblin';
import { MAX_COMPARISON_ZONES } from '@/lib/date-goblin';
import { ZonePicker } from './ZonePicker';
import styles from './date-goblin.module.css';

type Ok = Extract<Interpretation, { status: 'ok' }>;

interface Props {
  interp: Ok;
  zones: string[];
  comparisonCount: number;
  onAddZone: (zone: string) => void;
  onRemoveZone: (zone: string) => void;
}

export function ZoneTable({ interp, zones, comparisonCount, onAddZone, onRemoveZone }: Props) {
  const canAdd = comparisonCount < MAX_COMPARISON_ZONES;
  // The primary zone is the *source* for a local wall time, but a *view* zone for
  // an instant (which already knows its moment) — label it honestly for each.
  const roleLabel: Record<string, string> = {
    utc: 'UTC',
    system: 'system',
    primary: interp.sourceKind === 'local' ? 'source' : 'view',
  };

  return (
    <section className={styles.panel} aria-label="Across time zones">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Across time zones</h2>
        <span className={styles.panelHint}>{interp.zones.length} shown</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.zoneTableWrap}>
          <table className={styles.zoneTable}>
            <thead>
              <tr>
                <th scope="col">Zone</th>
                <th scope="col">Local time</th>
                <th scope="col">Offset</th>
                <th scope="col">
                  <span className="visually-hidden">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {interp.zones.map((row) => {
                const removable = row.roles.includes('comparison');
                const anchorRoles = row.roles.filter((r) => r !== 'comparison');
                return (
                  <tr key={row.reading.zoneId}>
                    <td>
                      <span className={styles.zoneName}>{row.reading.zoneId}</span>
                      {anchorRoles.map((role) => (
                        <span key={role} className={styles.roleTag}>
                          {roleLabel[role] ?? role}
                        </span>
                      ))}
                    </td>
                    <td>
                      <span className={styles.zoneLocal}>{row.reading.label}</span>
                      {row.reading.abbreviation && (
                        <span className={styles.abbr}> · {row.reading.abbreviation}</span>
                      )}
                    </td>
                    <td className={styles.zoneOffset}>{row.reading.offset}</td>
                    <td>
                      {removable && (
                        <button
                          type="button"
                          className={styles.removeBtn}
                          onClick={() => onRemoveZone(row.reading.zoneId)}
                          aria-label={`Remove ${row.reading.zoneId} from comparison`}
                          title="Remove"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className={styles.addZone}>
          {canAdd ? (
            <ZonePicker
              key={comparisonCount}
              value=""
              onChange={onAddZone}
              label="Add a comparison zone"
              zones={zones}
            />
          ) : (
            <p className={styles.rangeNote}>
              Comparison zones are capped at {MAX_COMPARISON_ZONES} — this is an instrument, not a
              world clock.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
