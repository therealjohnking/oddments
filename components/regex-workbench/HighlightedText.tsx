'use client';

import { useEffect, useMemo, useRef } from 'react';
import { HIGHLIGHT_TEXT_CAP, type MatchRecord, type MatchResult } from '@/lib/regex-workbench';
import { buildHighlight } from './highlight';
import styles from './regex-workbench.module.css';

interface Props {
  text: string;
  result: MatchResult;
  executing: boolean;
  selectedIndex: number;
  onSelect: (index: number) => void;
}

export function HighlightedText({ text, result, executing, selectedIndex, onSelect }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const model = useMemo(
    () => buildHighlight(text, result.matches, HIGHLIGHT_TEXT_CAP),
    [text, result.matches],
  );

  // Reveal the selected match when it changes (keyboard navigation especially).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const selected = container.querySelector('[data-selected="true"]');
    selected?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedIndex, model]);

  const isSelected = (match: MatchRecord) => match.ordinal - 1 === selectedIndex;

  return (
    <section className={styles.panel} aria-label="Matches in context">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          In context <span className={styles.panelHint}>· click a match to inspect it</span>
        </h2>
      </div>

      {text === '' ? (
        <p className={styles.emptyHint}>Enter test text above to see matches highlighted here.</p>
      ) : result.status === 'timeout' ? (
        <p className={styles.emptyHint}>
          Matching was stopped before it finished, so there is nothing to highlight.
        </p>
      ) : result.matches.length === 0 && !executing ? (
        <p className={styles.emptyHint}>No matches to highlight in this text.</p>
      ) : (
        <div className={styles.highlightScroll} ref={scrollRef}>
          <pre className={styles.highlightText}>
            {model.segments.map((segment, index) => {
              if (segment.kind === 'text') {
                return <span key={index}>{segment.text}</span>;
              }
              if (segment.kind === 'zero') {
                const selected = isSelected(segment.match);
                return (
                  <span
                    key={index}
                    className={styles.zero}
                    data-selected={selected}
                    title={`Zero-width match #${segment.match.ordinal} at offset ${segment.match.start}`}
                    onClick={() => onSelect(segment.match.ordinal - 1)}
                  />
                );
              }
              const selected = isSelected(segment.match);
              return (
                <mark
                  key={index}
                  className={styles.mark}
                  data-selected={selected}
                  title={`Match #${segment.match.ordinal} at offset ${segment.match.start}`}
                  onClick={() => onSelect(segment.match.ordinal - 1)}
                >
                  {segment.text}
                </mark>
              );
            })}
          </pre>
        </div>
      )}

      {model.truncated && (
        <p className={styles.footNote}>
          This text is long: the highlighted view is truncated at{' '}
          {HIGHLIGHT_TEXT_CAP.toLocaleString()} units, but the match list and counts are unaffected.
        </p>
      )}
    </section>
  );
}
