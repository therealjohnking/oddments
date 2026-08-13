import { countsTowardHeadline, type Analysis, type CategoryId } from '@/lib/inspector';
import styles from './inspector.module.css';

interface Props {
  analysis: Analysis;
  activeCategory: CategoryId | null;
  onSelectCategory: (category: CategoryId) => void;
}

export function SummaryBar({ analysis, activeCategory, onSelectCategory }: Props) {
  const found = analysis.headlineCount > 0;
  const typeCount = analysis.categorySummaries.filter((s) =>
    countsTowardHeadline(s.category),
  ).length;
  const headlineText = found
    ? `hidden or unusual ${analysis.headlineCount === 1 ? 'character' : 'characters'} across ${typeCount} ${typeCount === 1 ? 'type' : 'types'}`
    : 'No hidden or unusual characters found';
  const liveSentence = found
    ? `${analysis.headlineCount} hidden or unusual characters found across ${typeCount} types.`
    : 'No hidden or unusual characters found.';

  const stats: { num: number; label: string }[] = [
    { num: analysis.stats.codePoints, label: 'Characters' },
    ...(analysis.stats.graphemes !== analysis.stats.codePoints
      ? [{ num: analysis.stats.graphemes, label: 'Graphemes' }]
      : []),
    { num: analysis.stats.words, label: 'Words' },
    { num: analysis.stats.lines, label: 'Lines' },
    { num: analysis.stats.bytes, label: 'Bytes (UTF-8)' },
    { num: analysis.stats.asciiSpaces, label: 'Spaces' },
    ...(analysis.stats.tabs > 0 ? [{ num: analysis.stats.tabs, label: 'Tabs' }] : []),
  ];

  const le = analysis.lineEndings;
  const linePills: string[] = [];
  if (le.lf) linePills.push(`LF ×${le.lf}`);
  if (le.crlf) linePills.push(`CRLF ×${le.crlf}`);
  if (le.cr) linePills.push(`CR ×${le.cr}`);

  return (
    <section className={styles.panel} aria-label="Summary">
      <div className={styles.panelBody}>
        <p className="visually-hidden" role="status">
          {liveSentence}
        </p>

        <div className={styles.summaryHeadline}>
          <span
            className={styles.headlineNum}
            data-tone={found ? 'found' : 'clean'}
            aria-hidden="true"
          >
            {found ? analysis.headlineCount.toLocaleString() : '✓'}
          </span>
          <span className={styles.headlineText}>{headlineText}</span>
        </div>

        <div className={styles.statGrid}>
          {stats.map((stat) => (
            <div className={styles.stat} key={stat.label}>
              <span className={styles.statNum}>{stat.num.toLocaleString()}</span>
              <span className={styles.statLabel}>{stat.label}</span>
            </div>
          ))}
        </div>

        <div className={styles.metaRow}>
          {linePills.map((pill) => (
            <span className={styles.metaPill} key={pill}>
              {pill}
            </span>
          ))}
          {le.mixed && (
            <span className={styles.metaPill} data-tone="warn">
              Mixed line endings
            </span>
          )}
          {analysis.bom && (
            <span className={styles.metaPill} data-tone="warn">
              Byte-order mark
            </span>
          )}
          {analysis.trailingWhitespace.length > 0 && (
            <span className={styles.metaPill} data-tone="warn">
              Trailing whitespace: {analysis.trailingWhitespace.length}{' '}
              {analysis.trailingWhitespace.length === 1 ? 'line' : 'lines'}
            </span>
          )}
        </div>

        {analysis.categorySummaries.length > 0 && (
          <div className={styles.catChips}>
            {analysis.categorySummaries.map((summary) => (
              <button
                type="button"
                key={summary.category}
                className={styles.catChip}
                data-active={activeCategory === summary.category}
                aria-pressed={activeCategory === summary.category}
                onClick={() => onSelectCategory(summary.category)}
              >
                <span className={styles.catDot} data-sev={summary.severity} aria-hidden="true" />
                {summary.label}
                <span className={styles.catCount}>{summary.count.toLocaleString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
