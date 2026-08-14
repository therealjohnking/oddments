'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import {
  analyzePair,
  diffInMode,
  toSummaryReport,
  toUnifiedDiff,
  EXACT_LENS,
  EXAMPLES,
  type DiffMode,
  type LensState,
} from '@/lib/diffoscope';
import { countCodePoints } from '@/lib/inspector';
import { ControlsBar, type DiffViewMode } from './ControlsBar';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { DiffView } from './DiffView';
import { EditorsPanel } from './EditorsPanel';
import { EmptyState } from './EmptyState';
import { VerdictPanel } from './VerdictPanel';
import { copyToClipboard } from './clipboard';
import styles from './diffoscope.module.css';

function joinList(items: string[]): string {
  if (items.length <= 1) return items.join('');
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

function lensSummaryText(lens: LensState): string {
  const active: string[] = [];
  if (lens.ignoreCase) active.push('case');
  if (lens.ignoreWhitespace) active.push('whitespace');
  if (lens.nfc) active.push('Unicode form');
  return joinList(active);
}

export function DiffoscopeApp() {
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [mode, setMode] = useState<DiffMode>('word');
  const [view, setView] = useState<DiffViewMode>('inline');
  const [lens, setLens] = useState<LensState>(EXACT_LENS);
  const [forceChar, setForceChar] = useState(false);
  const [status, setStatus] = useState('');

  const deferredA = useDeferredValue(a);
  const deferredB = useDeferredValue(b);

  const analysis = useMemo(() => analyzePair(deferredA, deferredB), [deferredA, deferredB]);
  const diff = useMemo(
    () => diffInMode(deferredA, deferredB, mode, lens, { forceChar }),
    [deferredA, deferredB, mode, lens, forceChar],
  );

  // Char counts track the *live* textareas (not the deferred analysis) so the
  // "N chars" labels never lag behind what the user just typed or pasted.
  const aChars = useMemo(() => countCodePoints(a), [a]);
  const bChars = useMemo(() => countCodePoints(b), [b]);

  const lensActive = lens.ignoreCase || lens.ignoreWhitespace || lens.nfc;
  const lensSummary = lensSummaryText(lens);

  const handleExample = useCallback((id: string) => {
    const example = EXAMPLES.find((e) => e.id === id);
    if (!example) return;
    setA(example.a);
    setB(example.b);
    setMode(example.mode);
    setForceChar(false);
    setStatus(`Loaded the “${example.label}” example.`);
  }, []);

  const handleSwap = useCallback(() => {
    setA(b);
    setB(a);
    setStatus('Swapped A and B.');
  }, [a, b]);

  const handleClear = useCallback(() => {
    setA('');
    setB('');
    setForceChar(false);
    setStatus('Cleared.');
  }, []);

  const copySummary = useCallback(async () => {
    const ok = await copyToClipboard(toSummaryReport(analysis, diff));
    setStatus(
      ok
        ? 'Comparison summary copied to the clipboard.'
        : 'Copy failed — clipboard access blocked.',
    );
  }, [analysis, diff]);

  const copyUnified = useCallback(async () => {
    const patch = toUnifiedDiff(deferredA, deferredB, lens);
    const ok = await copyToClipboard(patch || '(no line differences)');
    setStatus(
      ok ? 'Unified diff copied to the clipboard.' : 'Copy failed — clipboard access blocked.',
    );
  }, [deferredA, deferredB, lens]);

  const bothEmpty = a.length === 0 && b.length === 0;

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / diffoscope
          </p>
          <h1 className={styles.title}>Diffoscope</h1>
          <p className={styles.subtitle}>
            A human-oriented text comparison instrument. Paste two versions and see exactly what
            changed — by word, character, or line — including the differences your eyes slide past:
            whitespace, invisible characters, look-alike punctuation, and Unicode quirks.
          </p>
          <p className={styles.premise}>
            <strong>Show me what changed — even what I can&rsquo;t see.</strong> Diffoscope explains
            differences; it never edits your text. Everything runs in your browser.
          </p>
        </header>

        <EditorsPanel
          a={a}
          b={b}
          aChars={aChars}
          bChars={bChars}
          onChangeA={setA}
          onChangeB={setB}
          onSwap={handleSwap}
          onClear={handleClear}
          onExample={handleExample}
        />

        {bothEmpty ? (
          <div className={styles.stack}>
            <EmptyState onExample={handleExample} />
          </div>
        ) : (
          <div className={styles.stack}>
            <ControlsBar
              mode={mode}
              onMode={setMode}
              view={view}
              onView={setView}
              lens={lens}
              onLens={setLens}
            />
            <VerdictPanel analysis={analysis} />
            <div className={styles.results}>
              <div className={styles.main}>
                <DiffView
                  diff={diff}
                  view={view}
                  lensActive={lensActive}
                  lensSummary={lensSummary}
                  onForceChar={() => setForceChar(true)}
                  onCopyUnified={copyUnified}
                />
              </div>
              <div className={styles.side}>
                <DiagnosticsPanel analysis={analysis} onCopySummary={copySummary} />
              </div>
            </div>
          </div>
        )}

        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
