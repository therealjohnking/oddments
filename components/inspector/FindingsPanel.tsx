import { useState } from 'react';
import { formatCodePoint, type Analysis, type CategoryId, type Finding } from '@/lib/inspector';
import styles from './inspector.module.css';

const PER_CATEGORY = 100;

interface Props {
  analysis: Analysis;
  activeCategory: CategoryId | null;
  focusedId: string | null;
  onSelectFinding: (id: string) => void;
  onSelectLine: (line: number) => void;
  onClearFilter: () => void;
  onCopyText: (text: string, successMessage: string) => void;
}

function groupFindings(findings: Finding[]): Map<CategoryId, Finding[]> {
  const map = new Map<CategoryId, Finding[]>();
  for (const finding of findings) {
    const list = map.get(finding.category);
    if (list) list.push(finding);
    else map.set(finding.category, [finding]);
  }
  return map;
}

function buildReport(analysis: Analysis): string {
  const lines: string[] = ['Invisible Character Inspector — report', ''];
  lines.push(
    analysis.headlineCount > 0
      ? `${analysis.headlineCount} hidden or unusual characters found.`
      : 'No hidden or unusual characters found.',
  );
  lines.push(
    `Characters: ${analysis.stats.codePoints}  ·  Bytes (UTF-8): ${analysis.stats.bytes}  ·  Lines: ${analysis.stats.lines}`,
  );
  if (analysis.categorySummaries.length > 0) {
    lines.push('', 'By category:');
    for (const summary of analysis.categorySummaries) {
      lines.push(`  ${summary.label}: ${summary.count}`);
    }
  }
  if (analysis.findings.length > 0) {
    lines.push('', 'Occurrences:');
    for (const finding of analysis.findings) {
      lines.push(
        `  Ln ${finding.line}:${finding.column}\t${formatCodePoint(finding.codePoint)}\t${finding.name}`,
      );
    }
    if (analysis.findingsCapped) lines.push('  … (list truncated for a very large input)');
  }
  return lines.join('\n');
}

export function FindingsPanel({
  analysis,
  activeCategory,
  focusedId,
  onSelectFinding,
  onSelectLine,
  onClearFilter,
  onCopyText,
}: Props) {
  const [expanded, setExpanded] = useState<Set<CategoryId>>(new Set());
  const groups = groupFindings(analysis.findings);

  const visibleSummaries = activeCategory
    ? analysis.categorySummaries.filter((s) => s.category === activeCategory)
    : analysis.categorySummaries;

  const showTrailing = !activeCategory && analysis.trailingWhitespace.length > 0;
  const nothing =
    analysis.categorySummaries.length === 0 && analysis.trailingWhitespace.length === 0;

  return (
    <section className={styles.panel} aria-label="Findings">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Findings</h2>
        <div className={styles.revealToolbar}>
          {activeCategory && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={onClearFilter}
            >
              Clear filter ✕
            </button>
          )}
          {analysis.findings.length > 0 && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() =>
                onCopyText(buildReport(analysis), 'Findings report copied to the clipboard.')
              }
            >
              Copy report
            </button>
          )}
        </div>
      </div>

      <div className={styles.panelBody}>
        {nothing ? (
          <p className={styles.emptyFindings}>
            No hidden or unusual characters — this text looks clean.
          </p>
        ) : (
          <>
            {visibleSummaries.map((summary) => {
              const items = groups.get(summary.category) ?? [];
              const isExpanded = expanded.has(summary.category);
              const shown = isExpanded ? items : items.slice(0, PER_CATEGORY);
              const remainingStored = items.length - shown.length;
              const beyondStored = summary.count - items.length;

              return (
                <div className={styles.group} key={summary.category}>
                  <div className={styles.groupHead}>
                    <span
                      className={styles.catDot}
                      data-sev={summary.severity}
                      aria-hidden="true"
                    />
                    <span className={styles.groupTitle}>{summary.label}</span>
                    <span className={styles.groupCount}>{summary.count.toLocaleString()}</span>
                  </div>
                  <p className={styles.groupDesc}>{summary.description}</p>
                  <ul className={styles.occList}>
                    {shown.map((finding) => (
                      <li key={finding.id}>
                        <button
                          type="button"
                          id={`finding-${finding.id}`}
                          className={styles.occ}
                          data-focused={focusedId === finding.id}
                          onClick={() => onSelectFinding(finding.id)}
                        >
                          <span className={styles.occPos}>
                            Ln {finding.line}:{finding.column}
                          </span>
                          <span className={styles.occName}>{finding.name}</span>
                          <span className={styles.occCp}>{formatCodePoint(finding.codePoint)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  {remainingStored > 0 && (
                    <button
                      type="button"
                      className={styles.moreLink}
                      onClick={() => setExpanded((prev) => new Set(prev).add(summary.category))}
                    >
                      Show {remainingStored.toLocaleString()} more
                    </button>
                  )}
                  {beyondStored > 0 && (
                    <p className={styles.groupDesc}>
                      + {beyondStored.toLocaleString()} more not listed (very large input).
                    </p>
                  )}
                </div>
              );
            })}

            {showTrailing && (
              <div className={styles.group}>
                <div className={styles.groupHead}>
                  <span className={styles.catDot} data-sev="warning" aria-hidden="true" />
                  <span className={styles.groupTitle}>Trailing whitespace</span>
                  <span className={styles.groupCount}>
                    {analysis.trailingWhitespace.length.toLocaleString()}
                  </span>
                </div>
                <p className={styles.groupDesc}>Spaces or tabs at the end of a line.</p>
                <ul className={styles.occList}>
                  {analysis.trailingWhitespace.slice(0, PER_CATEGORY).map((tw) => (
                    <li key={`tw-${tw.line}`}>
                      <button
                        type="button"
                        className={styles.occ}
                        onClick={() => onSelectLine(tw.line)}
                      >
                        <span className={styles.occPos}>Ln {tw.line}</span>
                        <span className={styles.occName}>
                          {tw.length} trailing {tw.length === 1 ? 'character' : 'characters'}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
