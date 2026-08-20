'use client';

import type { MatchResult } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  result: MatchResult;
  executing: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
  onCopySummary: () => void;
  canCopy: boolean;
}

export function MatchSummary({
  result,
  executing,
  selectedIndex,
  onSelect,
  onCopySummary,
  canCopy,
}: Props) {
  const count = result.matches.length;
  const hasMatches = count > 0;

  return (
    <section className={styles.panel} aria-label="Match summary">
      <div className={styles.summaryBar}>
        {executing ? (
          <span className={styles.summaryCount}>Matching…</span>
        ) : result.status === 'timeout' ? (
          <>
            <span className={styles.badge + ' ' + styles.badgeDanger}>■ Stopped</span>
            <span className={styles.summaryNote}>
              Matching took too long and was stopped — this pattern may backtrack heavily on this
              input. It is not proof of a vulnerability.
            </span>
          </>
        ) : (
          <>
            <span className={styles.summaryCount}>
              {count === 0 ? (
                'No matches'
              ) : (
                <>
                  <strong>{count.toLocaleString()}</strong>
                  {result.truncated ? '+' : ''} {count === 1 ? 'match' : 'matches'}
                </>
              )}
            </span>
            {!result.global && hasMatches && (
              <span className={styles.summaryNote}>
                First match only — add the <code className={styles.inlineCode}>g</code> flag to find
                all.
              </span>
            )}
            {result.truncated && (
              <span className={styles.badge + ' ' + styles.badgeWarn}>
                ▲ Showing first {result.cap.toLocaleString()}
              </span>
            )}
          </>
        )}

        {canCopy && (result.status === 'timeout' || hasMatches) && (
          <button
            type="button"
            className={styles.copyBtn}
            style={{ marginLeft: hasMatches && result.status === 'ok' ? undefined : 'auto' }}
            onClick={onCopySummary}
          >
            Copy summary
          </button>
        )}

        {hasMatches && result.status === 'ok' && (
          <div className={styles.navigator}>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Previous match"
              disabled={count <= 1}
              onClick={() => onSelect((selectedIndex - 1 + count) % count)}
            >
              ‹
            </button>
            <span className={styles.navLabel} aria-live="polite">
              {selectedIndex + 1} of {count.toLocaleString()}
              {result.truncated ? '+' : ''}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              aria-label="Next match"
              disabled={count <= 1}
              onClick={() => onSelect((selectedIndex + 1) % count)}
            >
              ›
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
