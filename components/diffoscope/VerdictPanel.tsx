import type { PairAnalysis, SideStats, VerdictKind } from '@/lib/diffoscope';
import styles from './diffoscope.module.css';

interface Props {
  analysis: PairAnalysis;
}

const DIM_LABEL: Record<string, string> = {
  'line-endings': 'line endings',
  whitespace: 'whitespace',
  case: 'letter case',
  nfc: 'Unicode form',
  punctuation: 'punctuation',
  homoglyph: 'look-alike letters',
  invisibles: 'invisible characters',
};

function tone(kind: VerdictKind): 'identical' | 'cosmetic' | 'different' {
  if (kind === 'identical') return 'identical';
  if (kind === 'different' || kind === 'empty-vs-nonempty') return 'different';
  return 'cosmetic';
}

function endingLabel(side: SideStats): string {
  const { lineEndings } = side;
  if (lineEndings.total === 0) return 'no line breaks';
  if (lineEndings.mixed) return 'mixed endings';
  return (lineEndings.dominant ?? 'lf').toUpperCase();
}

function Stat({ label, aValue, bValue }: { label: string; aValue: string; bValue: string }) {
  return (
    <div className={styles.stat}>
      <div className={styles.statNum}>
        {aValue}
        <span className={styles.sep} aria-hidden="true">
          /
        </span>
        <span className={styles.b}>{bValue}</span>
      </div>
      <span className={styles.statLabel}>{label} (A / B)</span>
    </div>
  );
}

/** The headline verdict, contributing cosmetic dimensions, and per-side stats. */
export function VerdictPanel({ analysis }: Props) {
  const { verdict, a, b } = analysis;
  return (
    <section className={styles.panel} aria-label="Comparison summary">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Summary</h2>
      </div>
      <div className={styles.panelBody}>
        <div className={styles.verdictHead}>
          <span className={styles.verdictBadge} data-tone={tone(verdict.kind)}>
            {verdict.label}
          </span>
          <p className={styles.verdictHeadline}>{verdict.headline}</p>
        </div>

        {verdict.dimensions.length > 0 && (
          <ul className={styles.dimChips} aria-label="Cosmetic differences">
            {verdict.dimensions.map((dim) => (
              <li key={dim} className={styles.dimChip}>
                {DIM_LABEL[dim] ?? dim}
              </li>
            ))}
          </ul>
        )}

        <div className={styles.statGrid}>
          <Stat
            label="Characters"
            aValue={a.chars.toLocaleString()}
            bValue={b.chars.toLocaleString()}
          />
          <Stat label="Words" aValue={a.words.toLocaleString()} bValue={b.words.toLocaleString()} />
          <Stat label="Lines" aValue={a.lines.toLocaleString()} bValue={b.lines.toLocaleString()} />
          <Stat label="Bytes" aValue={a.bytes.toLocaleString()} bValue={b.bytes.toLocaleString()} />
        </div>

        <div className={styles.metaRow}>
          <span className={styles.metaPill}>A: {endingLabel(a)}</span>
          <span className={styles.metaPill}>B: {endingLabel(b)}</span>
        </div>
      </div>
    </section>
  );
}
