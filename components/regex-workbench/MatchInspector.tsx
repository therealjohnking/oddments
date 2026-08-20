'use client';

import type { GroupCapture, MatchRecord } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  match: MatchRecord | null;
  onCopy: (text: string, label: string) => void;
}

function posLabel(match: Pick<MatchRecord, 'start' | 'end' | 'startPos' | 'endPos'>): string {
  const { startPos, endPos } = match;
  const line =
    startPos.line === endPos.line
      ? `L${startPos.line}:${startPos.column}–${endPos.column}`
      : `L${startPos.line}:${startPos.column}–L${endPos.line}:${endPos.column}`;
  return `[${match.start}, ${match.end}) · ${line}`;
}

function groupPos(group: GroupCapture): string | null {
  if (group.start === null || group.end === null || !group.startPos || !group.endPos) return null;
  return posLabel({
    start: group.start,
    end: group.end,
    startPos: group.startPos,
    endPos: group.endPos,
  });
}

function CaptureValue({ value }: { value: string | null }) {
  if (value === null) {
    return (
      <span className={`${styles.tag} ${styles.tagUnmatched}`}>
        unmatched — did not participate
      </span>
    );
  }
  if (value === '') {
    return <span className={`${styles.tag} ${styles.tagEmpty}`}>empty string</span>;
  }
  return <span className={styles.captureValue}>{value}</span>;
}

function matchToText(match: MatchRecord): string {
  const lines = [`Match #${match.ordinal} ${posLabel(match)}${match.empty ? ' (zero-width)' : ''}`];
  lines.push(`  $0 = ${JSON.stringify(match.value)}`);
  for (const group of match.groups) {
    const label = group.name ? `$${group.number} <${group.name}>` : `$${group.number}`;
    const value = group.value === null ? '(unmatched)' : JSON.stringify(group.value);
    const pos = groupPos(group);
    lines.push(`  ${label} = ${value}${pos ? ` ${pos}` : ''}`);
  }
  return lines.join('\n');
}

export function MatchInspector({ match, onCopy }: Props) {
  return (
    <section className={styles.panel} aria-label="Selected match">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Selected match
          {match ? <span className={styles.panelHint}> · #{match.ordinal}</span> : null}
        </h2>
        {match && (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => onCopy(matchToText(match), 'Match details')}
          >
            Copy details
          </button>
        )}
      </div>
      <div className={styles.panelBody}>
        {!match ? (
          <p className={styles.emptyHint} style={{ margin: 0 }}>
            No match selected. Matches appear here with their capture groups and exact positions.
          </p>
        ) : (
          <ul className={styles.captureList}>
            <li className={`${styles.capture} ${styles.captureFull}`}>
              <div className={styles.captureHead}>
                <span className={styles.captureLabel}>$0</span>
                <span className={styles.captureName}>whole match</span>
                {match.empty && (
                  <span className={`${styles.tag} ${styles.tagZero}`}>zero-width</span>
                )}
                <span className={styles.capturePos}>{posLabel(match)}</span>
              </div>
              {match.empty ? (
                <p className={styles.captureValue}>
                  <span className={styles.captureValueEmpty}>
                    (empty — matches between characters)
                  </span>
                </p>
              ) : (
                <p className={styles.captureValue}>{match.value}</p>
              )}
            </li>

            {match.groups.map((group) => {
              const pos = groupPos(group);
              return (
                <li key={group.number} className={styles.capture}>
                  <div className={styles.captureHead}>
                    <span className={styles.captureLabel}>${group.number}</span>
                    {group.name && <span className={styles.captureName}>{group.name}</span>}
                    {pos && <span className={styles.capturePos}>{pos}</span>}
                  </div>
                  <p className={styles.captureValue}>
                    <CaptureValue value={group.value} />
                  </p>
                </li>
              );
            })}

            {match.groups.length === 0 && (
              <li className={styles.capture}>
                <p className={styles.captureValue} style={{ margin: 0 }}>
                  <span className={styles.captureValueEmpty}>
                    This pattern has no capture groups.
                  </span>
                </p>
              </li>
            )}
          </ul>
        )}
      </div>
    </section>
  );
}
