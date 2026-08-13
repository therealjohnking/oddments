import { useMemo } from 'react';
import type { Analysis, Finding } from '@/lib/inspector';
import { FindingMarker } from './FindingMarker';
import { buildExpandedText, segmentLine } from './segments';
import styles from './inspector.module.css';

export type RevealMode = 'visual' | 'expanded';

const REVEAL_MAX_LINES = 400;

const TERMINATOR_GLYPH: Record<string, string> = {
  lf: '↵',
  cr: '␍',
  crlf: '␍↵',
  none: '',
};

interface Props {
  analysis: Analysis;
  mode: RevealMode;
  onModeChange: (mode: RevealMode) => void;
  showSpaces: boolean;
  onShowSpacesChange: (value: boolean) => void;
  focusedId: string | null;
  onSelectFinding: (id: string) => void;
  navFindings: Finding[];
  onCopyText: (text: string, successMessage: string) => void;
}

export function RevealPanel({
  analysis,
  mode,
  onModeChange,
  showSpaces,
  onShowSpacesChange,
  focusedId,
  onSelectFinding,
  navFindings,
  onCopyText,
}: Props) {
  const lines = analysis.lines.slice(0, REVEAL_MAX_LINES);
  const truncated = analysis.lines.length > REVEAL_MAX_LINES || analysis.linesCapped;

  const expandedText = useMemo(
    () => buildExpandedText(analysis, showSpaces, REVEAL_MAX_LINES),
    [analysis, showSpaces],
  );

  const idx = focusedId ? navFindings.findIndex((f) => f.id === focusedId) : -1;
  const total = navFindings.length;

  const goNext = () => {
    if (total === 0) return;
    const next = idx < 0 ? 0 : Math.min(idx + 1, total - 1);
    const finding = navFindings[next];
    if (finding) onSelectFinding(finding.id);
  };
  const goPrev = () => {
    if (total === 0) return;
    const prev = idx < 0 ? total - 1 : Math.max(idx - 1, 0);
    const finding = navFindings[prev];
    if (finding) onSelectFinding(finding.id);
  };

  return (
    <section className={styles.panel} aria-label="Reveal">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>Reveal</h2>
        <div className={styles.revealToolbar}>
          <div className={styles.segmented} role="group" aria-label="Reveal mode">
            <button
              type="button"
              className={styles.segmentedBtn}
              aria-pressed={mode === 'visual'}
              onClick={() => onModeChange('visual')}
            >
              Visual
            </button>
            <button
              type="button"
              className={styles.segmentedBtn}
              aria-pressed={mode === 'expanded'}
              onClick={() => onModeChange('expanded')}
            >
              Expanded text
            </button>
          </div>

          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={showSpaces}
              onChange={(event) => onShowSpacesChange(event.target.checked)}
            />
            Show all spaces
          </label>

          <div className={styles.navGroup} aria-label="Jump between findings">
            <button
              type="button"
              className={styles.navBtn}
              onClick={goPrev}
              disabled={total === 0 || idx === 0}
              aria-label="Previous finding"
            >
              ‹
            </button>
            <span className={styles.navStatus}>
              {idx >= 0 ? idx + 1 : '–'} / {total}
            </span>
            <button
              type="button"
              className={styles.navBtn}
              onClick={goNext}
              disabled={total === 0 || idx === total - 1}
              aria-label="Next finding"
            >
              ›
            </button>
          </div>

          {mode === 'expanded' && (
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => onCopyText(expandedText, 'Expanded text copied to the clipboard.')}
            >
              Copy expanded
            </button>
          )}
        </div>
      </div>

      {mode === 'visual' ? (
        <div className={styles.revealScroll} aria-hidden="true">
          <div className={styles.revealLines}>
            {lines.map((line) => {
              const segments = segmentLine(line, showSpaces);
              return (
                <div className={styles.lineRow} id={`line-${line.number}`} key={line.index}>
                  <span className={styles.gutter}>{line.number}</span>
                  <span className={styles.code}>
                    {segments.map((segment, segIndex) => {
                      if (segment.kind === 'text') {
                        return <span key={segIndex}>{segment.text}</span>;
                      }
                      if (segment.kind === 'space') {
                        return (
                          <span
                            key={segIndex}
                            className={styles.spaceDot}
                            data-trailing={segment.trailing}
                          >
                            {'·'.repeat(segment.count)}
                          </span>
                        );
                      }
                      return (
                        <FindingMarker
                          key={segIndexKey(segment.finding.id, segIndex)}
                          finding={segment.finding}
                          focused={focusedId === segment.finding.id}
                          onSelect={onSelectFinding}
                        />
                      );
                    })}
                    {line.terminator !== 'none' && (
                      <span className={styles.term}>{TERMINATOR_GLYPH[line.terminator]}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <pre
          className={styles.expanded}
          tabIndex={0}
          aria-label="Expanded text — each hidden or unusual character is shown as a bracketed token"
        >
          {expandedText}
        </pre>
      )}

      {truncated && (
        <p className={styles.revealFootNote}>
          Showing the first {REVEAL_MAX_LINES.toLocaleString()} lines. The summary and findings
          cover the entire input.
        </p>
      )}
    </section>
  );
}

function segIndexKey(id: string, index: number): string {
  return `${id}-${index}`;
}
