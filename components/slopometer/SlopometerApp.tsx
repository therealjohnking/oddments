'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { analyzeText, countWords, SLOP_SAMPLE, type SlopCategoryId } from '@/lib/slopometer';
import { AnnotatedPanel } from './AnnotatedPanel';
import { EmptyState } from './EmptyState';
import { FindingsPanel } from './FindingsPanel';
import { InputPanel } from './InputPanel';
import { ScorePanel } from './ScorePanel';
import { collectEvidence } from './segments';
import { copyToClipboard, readClipboard } from './clipboard';
import styles from './slopometer.module.css';

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

export function SlopometerApp() {
  const [input, setInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<SlopCategoryId | null>(null);
  const [focusedEvidence, setFocusedEvidence] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const pendingScroll = useRef<string | null>(null);
  const [status, setStatus] = useState('');

  const deferredInput = useDeferredValue(input);
  const analysis = useMemo(() => analyzeText(deferredInput), [deferredInput]);
  const evidence = useMemo(() => collectEvidence(analysis.findings), [analysis]);
  const wordCount = useMemo(() => countWords(input), [input]);

  // Scroll a requested mark into view. The target lives in a ref so the effect
  // never calls setState; `scrollTick` (bumped by handlers) re-runs it.
  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      });
    }
    pendingScroll.current = null;
  }, [scrollTick]);

  const selectEvidence = useCallback((id: string) => {
    setFocusedEvidence(id);
    pendingScroll.current = `slop-mark-${id}`;
    setScrollTick((tick) => tick + 1);
  }, []);

  const selectCategory = useCallback((category: SlopCategoryId) => {
    setActiveCategory((prev) => (prev === category ? null : category));
  }, []);

  const copyText = useCallback(async (text: string, successMessage: string) => {
    const ok = await copyToClipboard(text);
    setStatus(ok ? successMessage : 'Copy failed — your browser blocked clipboard access.');
  }, []);

  const handleExample = useCallback(() => {
    setInput(SLOP_SAMPLE);
    setActiveCategory(null);
    setFocusedEvidence(null);
    setStatus('Example text loaded.');
  }, []);

  const handleClear = useCallback(() => {
    setInput('');
    setActiveCategory(null);
    setFocusedEvidence(null);
    setStatus('Cleared.');
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await readClipboard();
    if (text === null) {
      setStatus('Clipboard read is unavailable here — paste directly with Ctrl or Cmd + V.');
      return;
    }
    setInput(text);
    setStatus(`Pasted ${countWords(text).toLocaleString()} words.`);
  }, []);

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / slopometer
          </p>
          <h1 className={styles.title}>Slopometer</h1>
          <p className={styles.subtitle}>
            A deterministic prose-style analyzer. Paste writing and it scores the stylistic tics
            that make text read as generic, over-polished, or performative — then shows you exactly
            which rules fired and why.
          </p>
          <p className={styles.premise}>
            <strong>Detect writing crimes, not artificial intelligence.</strong> Slopometer makes no
            claim about whether a human or a machine wrote anything. It just counts habits.
          </p>
        </header>

        <InputPanel
          value={input}
          wordCount={wordCount}
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
              <ScorePanel
                analysis={analysis}
                activeCategory={activeCategory}
                onSelectCategory={selectCategory}
              />
            </div>

            <div className={styles.results}>
              <div className={styles.main}>
                <AnnotatedPanel
                  text={deferredInput}
                  evidence={evidence}
                  focusedEvidence={focusedEvidence}
                  onSelectEvidence={selectEvidence}
                />
              </div>
              <div className={styles.side}>
                <FindingsPanel
                  analysis={analysis}
                  activeCategory={activeCategory}
                  focusedEvidence={focusedEvidence}
                  onSelectEvidence={selectEvidence}
                  onClearFilter={() => setActiveCategory(null)}
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
