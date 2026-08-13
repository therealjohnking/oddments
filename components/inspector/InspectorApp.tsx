'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeText,
  countCodePoints,
  defaultEnabledTransforms,
  EXAMPLE_TEXT,
  type CategoryId,
  type TransformId,
} from '@/lib/inspector';
import { CleanPanel } from './CleanPanel';
import { EmptyState } from './EmptyState';
import { FindingsPanel } from './FindingsPanel';
import { InputPanel } from './InputPanel';
import { RevealPanel, type RevealMode } from './RevealPanel';
import { SummaryBar } from './SummaryBar';
import { copyToClipboard, readClipboard } from './clipboard';
import styles from './inspector.module.css';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function InspectorApp() {
  const [input, setInput] = useState('');
  const [enabled, setEnabled] = useState<Set<TransformId>>(() => defaultEnabledTransforms());
  const [revealMode, setRevealMode] = useState<RevealMode>('visual');
  const [showSpaces, setShowSpaces] = useState(false);
  const [activeCategory, setActiveCategory] = useState<CategoryId | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const pendingScroll = useRef<string | null>(null);
  const [status, setStatus] = useState('');

  const deferredInput = useDeferredValue(input);
  const analysis = useMemo(() => analyzeText(deferredInput), [deferredInput]);

  const navFindings = useMemo(
    () =>
      activeCategory
        ? analysis.findings.filter((f) => f.category === activeCategory)
        : analysis.findings,
    [analysis, activeCategory],
  );

  // Scroll the requested element (a reveal chip or a line) into view. The
  // target lives in a ref so the effect never calls setState; `scrollTick`
  // (bumped by the selection handlers) is what re-runs it.
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target || revealMode !== 'visual') return;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    pendingScroll.current = null;
  }, [scrollTick, revealMode]);

  const selectFinding = useCallback((id: string) => {
    setFocusedId(id);
    pendingScroll.current = `reveal-${id}`;
    setScrollTick((tick) => tick + 1);
  }, []);

  const selectLine = useCallback((line: number) => {
    setRevealMode('visual');
    pendingScroll.current = `line-${line}`;
    setScrollTick((tick) => tick + 1);
  }, []);

  const selectCategory = useCallback((category: CategoryId) => {
    setActiveCategory((prev) => (prev === category ? null : category));
    setFocusedId(null);
  }, []);

  const toggleTransform = useCallback((id: TransformId) => {
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const copyText = useCallback(async (text: string, successMessage: string) => {
    const ok = await copyToClipboard(text);
    setStatus(ok ? successMessage : 'Copy failed — your browser blocked clipboard access.');
  }, []);

  const handleExample = useCallback(() => {
    setInput(EXAMPLE_TEXT);
    setActiveCategory(null);
    setFocusedId(null);
    setStatus('Example text loaded.');
  }, []);

  const handleClear = useCallback(() => {
    setInput('');
    setActiveCategory(null);
    setFocusedId(null);
    setStatus('Cleared.');
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await readClipboard();
    if (text === null) {
      setStatus('Clipboard read is unavailable here — paste directly with Ctrl or Cmd + V.');
      return;
    }
    setInput(text);
    setStatus(`Pasted ${countCodePoints(text).toLocaleString()} characters.`);
  }, []);

  const codePointCount = useMemo(() => countCodePoints(input), [input]);

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / invisible characters
          </p>
          <h1 className={styles.title}>Invisible Character Inspector</h1>
          <p className={styles.subtitle}>
            Paste any text to reveal the characters you can&rsquo;t normally see — zero-width
            spaces, non-breaking spaces, curly quotes, homoglyphs, control codes, and bidirectional
            tricks — with exact positions and code points, then clean them out conservatively.
          </p>
        </header>

        <InputPanel
          value={input}
          codePointCount={codePointCount}
          onChange={setInput}
          onPaste={handlePaste}
          onExample={handleExample}
          onClear={handleClear}
        />

        {analysis.isEmpty ? (
          <div style={{ marginTop: '1.25rem' }}>
            <EmptyState onExample={handleExample} />
          </div>
        ) : (
          <>
            <div style={{ marginTop: '1.25rem' }}>
              <SummaryBar
                analysis={analysis}
                activeCategory={activeCategory}
                onSelectCategory={selectCategory}
              />
            </div>

            {analysis.findingsCapped && (
              <p className={styles.notice} role="note">
                This input is very large: the findings list is truncated, but every count above is
                exact.
              </p>
            )}

            <div className={styles.results}>
              <div className={styles.main}>
                <RevealPanel
                  analysis={analysis}
                  mode={revealMode}
                  onModeChange={setRevealMode}
                  showSpaces={showSpaces}
                  onShowSpacesChange={setShowSpaces}
                  focusedId={focusedId}
                  onSelectFinding={selectFinding}
                  navFindings={navFindings}
                  onCopyText={copyText}
                />
              </div>
              <div className={styles.side}>
                <FindingsPanel
                  analysis={analysis}
                  activeCategory={activeCategory}
                  focusedId={focusedId}
                  onSelectFinding={selectFinding}
                  onSelectLine={selectLine}
                  onClearFilter={() => setActiveCategory(null)}
                  onCopyText={copyText}
                />
                <CleanPanel
                  input={input}
                  deferredInput={deferredInput}
                  enabled={enabled}
                  onToggle={toggleTransform}
                  onCopyText={copyText}
                />
              </div>
            </div>
          </>
        )}

        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
