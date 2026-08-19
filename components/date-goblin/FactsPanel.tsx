'use client';

import type { Interpretation, ZoneOffsetInfo } from '@/lib/date-goblin';
import styles from './date-goblin.module.css';

type Ok = Extract<Interpretation, { status: 'ok' }>;

function dstText(info: ZoneOffsetInfo): string {
  switch (info.dst) {
    case 'daylight':
      return `daylight saving in effect (+${info.dstShiftMinutes} min over standard)`;
    case 'standard':
      return 'standard time (this zone observes DST at other times of year)';
    case 'fixed':
      return 'no daylight saving in this zone';
    default:
      return 'daylight-saving status undetermined';
  }
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.fact}>
      <span className={styles.factLabel}>{label}</span>
      <span className={styles.factValue}>{value}</span>
    </div>
  );
}

export function FactsPanel({ interp }: { interp: Ok }) {
  const f = interp.facts;
  const info = interp.offsetInfo;

  return (
    <section className={styles.panel} aria-label="Calendar facts">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Calendar facts</h2>
        <span className={styles.panelHint}>in {f.zoneId}</span>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.factsGrid}>
          <Fact label="Weekday" value={f.weekdayName} />
          <Fact label="Date" value={`${f.monthName} ${f.day}, ${f.year}`} />
          <Fact label="Day of year" value={`${f.dayOfYear} of ${f.daysInYear}`} />
          <Fact label="ISO week" value={`${f.isoWeek}`} />
          <Fact
            label="ISO week-year"
            value={`${f.isoWeekYear}${f.isoWeekYear !== f.year ? ' ⚠' : ''}`}
          />
          <Fact label="Quarter" value={`Q${f.quarter}`} />
          <Fact label="Leap year" value={f.leapYear ? 'Yes' : 'No'} />
          <Fact label="Days in month" value={`${f.daysInMonth}`} />
        </div>
        <p className={styles.offsetLine}>
          Offset in {info.zoneId}: <strong>{info.offset}</strong>
          {info.abbreviation ? ` (${info.abbreviation})` : ''} — {dstText(info)}.
          {f.isoWeekYear !== f.year && (
            <>
              {' '}
              Note: the ISO week-year ({f.isoWeekYear}) differs from the calendar year ({f.year}) at
              this boundary.
            </>
          )}
        </p>
      </div>
    </section>
  );
}
