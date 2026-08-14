import type { DiffSegment, ModeDiff } from '@/lib/diffoscope';
import type { DiffViewMode } from './ControlsBar';
import styles from './diffoscope.module.css';

interface Props {
  diff: ModeDiff;
  view: DiffViewMode;
  lensActive: boolean;
  lensSummary: string;
  onForceChar: () => void;
  onCopyUnified: () => void;
}

/** Inline flowing runs for word/char mode. */
function InlineFlow({ segments }: { segments: DiffSegment[] }) {
  return (
    <p className={styles.diffFlow}>
      {segments.map((segment, index) => {
        if (segment.op === 'equal') return <span key={index}>{segment.value}</span>;
        if (segment.op === 'insert')
          return (
            <ins key={index} className={styles.ins}>
              {segment.value}
            </ins>
          );
        return (
          <del key={index} className={styles.del}>
            {segment.value}
          </del>
        );
      })}
    </p>
  );
}

/** One side of a split word/char view: A keeps deletes, B keeps inserts. */
function SplitFlow({ segments, side }: { segments: DiffSegment[]; side: 'a' | 'b' }) {
  const drop = side === 'a' ? 'insert' : 'delete';
  const markClass = side === 'a' ? styles.del : styles.ins;
  const Mark = side === 'a' ? 'del' : 'ins';
  return (
    <p className={styles.diffFlow}>
      {segments
        .filter((segment) => segment.op !== drop)
        .map((segment, index) =>
          segment.op === 'equal' ? (
            <span key={index}>{segment.value}</span>
          ) : (
            <Mark key={index} className={markClass}>
              {segment.value}
            </Mark>
          ),
        )}
    </p>
  );
}

function LineRow({ segment }: { segment: DiffSegment }) {
  const sign = segment.op === 'insert' ? '+' : segment.op === 'delete' ? '−' : ' ';
  return (
    <div className={styles.lineRow} data-op={segment.op}>
      <span className={styles.gutter}>{segment.aLine ?? ''}</span>
      <span className={styles.gutter}>{segment.bLine ?? ''}</span>
      <span className={styles.sign} aria-hidden="true">
        {sign}
      </span>
      <span className={styles.lineContent} data-op={segment.op}>
        {segment.value === '' ? ' ' : segment.value}
      </span>
    </div>
  );
}

/** Inline unified line view. */
function InlineLines({ segments }: { segments: DiffSegment[] }) {
  return (
    <div>
      {segments.map((segment, index) => (
        <LineRow key={index} segment={segment} />
      ))}
    </div>
  );
}

/** One side of a split line view. */
function SplitLines({ segments, side }: { segments: DiffSegment[]; side: 'a' | 'b' }) {
  const drop = side === 'a' ? 'insert' : 'delete';
  return (
    <div>
      {segments
        .filter((segment) => segment.op !== drop)
        .map((segment, index) => {
          const gutter = side === 'a' ? segment.aLine : segment.bLine;
          const op = segment.op === 'equal' ? 'equal' : side === 'a' ? 'delete' : 'insert';
          return (
            <div key={index} className={styles.lineRow} data-op={op}>
              <span className={styles.gutter}>{gutter ?? ''}</span>
              <span className={styles.sign} aria-hidden="true">
                {op === 'equal' ? ' ' : side === 'a' ? '−' : '+'}
              </span>
              <span className={styles.lineContent} data-op={op}>
                {segment.value === '' ? ' ' : segment.value}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function summarySentence(diff: ModeDiff): string {
  if (diff.equal) return `No ${diff.unit} differences.`;
  const changed = diff.mode === 'line' ? `, ${diff.changedLines ?? 0} changed lines` : '';
  return `${diff.inserted.toLocaleString()} ${diff.unit}s inserted, ${diff.deleted.toLocaleString()} deleted, in ${diff.changedRegions.toLocaleString()} ${diff.changedRegions === 1 ? 'place' : 'places'}${changed}.`;
}

/**
 * The primary comparison view. A visual presentation with semantic <ins>/<del>
 * markup that stays legible in monochrome (underline / strike-through, plus +/−
 * in line mode) and in forced-colors mode. It is not built from focusable
 * tokens; the Subtle differences panel is its structured, screen-reader
 * counterpart.
 */
export function DiffView({
  diff,
  view,
  lensActive,
  lensSummary,
  onForceChar,
  onCopyUnified,
}: Props) {
  const isLine = diff.mode === 'line';

  return (
    <section className={styles.panel} aria-label="Comparison">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Comparison{' '}
          <span className={styles.panelHint}>
            · {diff.unit} · {view}
          </span>
        </h2>
        {isLine && !diff.equal && (
          <button
            type="button"
            className={`${styles.btn} ${styles.btnGhost}`}
            onClick={onCopyUnified}
          >
            Copy unified diff
          </button>
        )}
      </div>

      {/* A static (non-live) screen-reader summary of the comparison. It is
          deliberately not an aria-live region: the diff recomputes on every
          keystroke, so announcing it would talk over the user while they type. */}
      <p className="visually-hidden">
        {diff.charDisabled
          ? 'Character comparison paused for a large input.'
          : summarySentence(diff)}
      </p>

      {diff.charDisabled ? (
        <div className={styles.diffNotice}>
          <p style={{ margin: 0 }}>
            Character-by-character comparison is heavy for inputs this large, so it&rsquo;s paused.
            Word and line comparison still work instantly; the summary above is exact.
          </p>
          <button type="button" className={styles.btn} onClick={onForceChar}>
            Compare characters anyway
          </button>
        </div>
      ) : diff.equal ? (
        <p className={styles.equalNote}>
          <span className={styles.equalBadge}>No differences.</span>
          {lensActive
            ? `The two sides match once ${lensSummary} ${lensSummary.includes('and') ? 'are' : 'is'} ignored.`
            : 'The two sides are identical at this granularity.'}
        </p>
      ) : view === 'split' ? (
        <div className={styles.split}>
          <div className={styles.splitPane}>
            <div className={styles.splitHead}>A / Before</div>
            <div className={styles.diffScroll} style={{ borderTop: 'none' }}>
              {isLine ? (
                <SplitLines segments={diff.segments} side="a" />
              ) : (
                <SplitFlow segments={diff.segments} side="a" />
              )}
            </div>
          </div>
          <div className={styles.splitPane}>
            <div className={styles.splitHead}>B / After</div>
            <div className={styles.diffScroll} style={{ borderTop: 'none' }}>
              {isLine ? (
                <SplitLines segments={diff.segments} side="b" />
              ) : (
                <SplitFlow segments={diff.segments} side="b" />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.diffScroll}>
          {isLine ? (
            <InlineLines segments={diff.segments} />
          ) : (
            <InlineFlow segments={diff.segments} />
          )}
        </div>
      )}

      {!diff.charDisabled && !diff.equal && lensActive && (
        <p className={styles.footNote}>
          Comparing with {lensSummary} ignored. The source text is unchanged.
        </p>
      )}
      {diff.degraded && (
        <p className={styles.footNote}>
          The inputs are very different, so an approximate (non-minimal) diff is shown. Counts
          remain exact.
        </p>
      )}
      {diff.renderCapped && (
        <p className={styles.footNote}>
          This comparison is large: the view is truncated, but every count above is exact.
        </p>
      )}
    </section>
  );
}
