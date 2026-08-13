import type { Analysis, SlopCategoryId } from '@/lib/slopometer';
import styles from './slopometer.module.css';

interface Props {
  analysis: Analysis;
  activeCategory: SlopCategoryId | null;
  onSelectCategory: (category: SlopCategoryId) => void;
}

export function ScorePanel({ analysis, activeCategory, onSelectCategory }: Props) {
  const { score, band, metrics } = analysis;
  const maxCategory = Math.max(1, ...analysis.categoryContributions.map((c) => c.contribution));

  const stats: { num: number; label: string }[] = [
    { num: metrics.words, label: metrics.words === 1 ? 'Word' : 'Words' },
    { num: metrics.sentences, label: 'Sentences' },
    { num: metrics.paragraphs, label: 'Paragraphs' },
    { num: metrics.characters, label: 'Characters' },
  ];

  const liveSentence = `Slopometer score ${score} out of 100: ${band.label}.`;

  return (
    <section className={styles.panel} aria-label="Score">
      <div className={styles.panelBody}>
        <p className="visually-hidden" role="status" aria-live="polite">
          {liveSentence}
        </p>

        <div className={styles.scoreTop}>
          <span className={styles.scoreNum} data-band={band.id} aria-hidden="true">
            {score}
            <span className={styles.scoreOutOf}> / 100</span>
          </span>
          <span className={styles.bandBox}>
            <span className={styles.bandLabel}>{band.label}</span>
            <span className={styles.bandBlurb}>{band.blurb}</span>
          </span>
        </div>

        <div
          className={styles.track}
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Slopometer score: ${score} of 100`}
        >
          <span className={styles.trackFill} data-band={band.id} style={{ width: `${score}%` }} />
        </div>
        <div className={styles.trackScale} aria-hidden="true">
          <span>0</span>
          <span>person</span>
          <span>LinkedIn</span>
          <span>content</span>
          <span>100</span>
        </div>

        {analysis.scoreCapped && (
          <p className={styles.disclaimer}>
            Raw total was {analysis.rawScore}; the score is clamped to 100.
          </p>
        )}

        {analysis.tooShort && (
          <p className={styles.shortNote} role="note">
            Short sample: phrase-level tells still count, but structural checks (paragraph shape,
            repetition, question density) need more text to mean anything. Treat this score as
            noise.
          </p>
        )}

        <div className={styles.statGrid}>
          {stats.map((stat) => (
            <div className={styles.stat} key={stat.label}>
              <span className={styles.statNum}>{stat.num.toLocaleString()}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

        {analysis.categoryContributions.length > 0 && (
          <div className={styles.catBars}>
            {analysis.categoryContributions.map((cat) => {
              const isActive = activeCategory === cat.category;
              return (
                <button
                  type="button"
                  key={cat.category}
                  className={styles.catBar}
                  data-active={isActive}
                  aria-pressed={isActive}
                  onClick={() => onSelectCategory(cat.category)}
                >
                  <span className={styles.catBarLabel}>{cat.label}</span>
                  <span className={styles.catBarValue}>
                    +{cat.contribution} · {cat.findingCount}{' '}
                    {cat.findingCount === 1 ? 'rule' : 'rules'}
                  </span>
                  <span className={styles.catBarTrack} aria-hidden="true">
                    <span
                      className={styles.catBarFill}
                      style={{ width: `${(cat.contribution / maxCategory) * 100}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <p className={styles.disclaimer}>
          A playful heuristic, not a verdict. Slopometer only counts stylistic tics it recognizes;
          it cannot, and does not, judge quality or tell whether a person or a machine wrote this.
        </p>
      </div>
    </section>
  );
}
