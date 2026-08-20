'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  MATCH_CAP,
  applyReplacement,
  compilePattern,
  computeDiagnostics,
  defaultSettings,
  deserializeSettings,
  emptyMatchResult,
  enrichMatches,
  evaluateTestCases,
  explainPattern,
  explainReplacement,
  MAX_TEST_CASES,
  saveSettings,
  STORAGE_KEY,
  toDiagnosticSummary,
  toggleFlag,
  type FlagId,
  type LiteralParse,
  type MatchResult,
  type RegexExample,
  type TestCase,
} from '@/lib/regex-workbench';
import type { RawMatch } from '@/lib/regex-workbench';
import { DiagnosticsPanel } from './DiagnosticsPanel';
import { EmptyState } from './EmptyState';
import { ExplanationPanel } from './ExplanationPanel';
import { HighlightedText } from './HighlightedText';
import { MatchInspector } from './MatchInspector';
import { MatchSummary } from './MatchSummary';
import { PatternPanel } from './PatternPanel';
import { ReplacementPanel } from './ReplacementPanel';
import { TestCasesPanel } from './TestCasesPanel';
import { TextPanel } from './TextPanel';
import { copyToClipboard } from './clipboard';
import { createExecutor, type Executor } from './executor';
import styles from './regex-workbench.module.css';

const STORE_SERVER = ' server';
const STORE_EMPTY = ' empty';

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
}
function getSnapshot(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? STORE_EMPTY;
  } catch {
    return STORE_EMPTY;
  }
}
function getServerSnapshot(): string {
  return STORE_SERVER;
}

interface ExecOutcomeState {
  status: 'ok' | 'timeout' | 'error';
  raw: RawMatch[];
  truncated: boolean;
  /** The exact inputs the outcome was computed against (positions align to `text`). */
  source: string;
  flags: string;
  text: string;
  error?: string;
}

const IDLE_OUTCOME: ExecOutcomeState = {
  status: 'ok',
  raw: [],
  truncated: false,
  source: '',
  flags: '',
  text: '',
};

let idCounter = 0;
function newId(): string {
  idCounter += 1;
  return `tc-${idCounter}`;
}

export function RegexWorkbenchApp() {
  const persisted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const [pattern, setPattern] = useState('');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('');
  const [replacement, setReplacement] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [status, setStatus] = useState('');
  const [initialized, setInitialized] = useState(false);

  const [execOutcome, setExecOutcome] = useState<ExecOutcomeState>(IDLE_OUTCOME);

  const executorRef = useRef<Executor | null>(null);

  // One-time client-only restore of persisted settings (flags only).
  if (!initialized && persisted !== STORE_SERVER) {
    const rawStore = persisted === STORE_EMPTY ? null : persisted;
    const restored = deserializeSettings(rawStore, defaultSettings()) ?? defaultSettings();
    setFlags(restored.flags);
    setInitialized(true);
  }

  // Persist flags (never pattern/text/replacement).
  useEffect(() => {
    if (!initialized) return;
    saveSettings({ flags });
  }, [initialized, flags]);

  // Create the off-thread executor once, on the client. This effect is declared
  // before the matching effect, so `executorRef` is populated by the time the
  // matching effect first runs in the same commit.
  useEffect(() => {
    executorRef.current = createExecutor();
    const executor = executorRef.current;
    return () => {
      executor?.dispose();
      executorRef.current = null;
    };
  }, []);

  const deferredText = useDeferredValue(text);
  const global = flags.includes('g') || flags.includes('y');

  const compile = useMemo(() => compilePattern(pattern, flags), [pattern, flags]);
  const execSource = compile.ok ? compile.source : null;
  const execFlags = compile.ok ? compile.execFlags : null;

  // Run matching off the main thread whenever the compiled pattern or text changes.
  // The effect body starts async work only; every setState happens later, inside
  // the promise callback (never synchronously during the effect).
  useEffect(() => {
    if (execSource === null || execFlags === null || deferredText === '') return;
    const executor = executorRef.current;
    if (!executor) return;
    const source = execSource;
    const runFlags = execFlags;
    let cancelled = false;
    executor
      .run({ source, flags: runFlags, text: deferredText, cap: MATCH_CAP })
      .then((outcome) => {
        if (cancelled || outcome.status === 'superseded') return;
        const base = { source, flags: runFlags, text: deferredText };
        if (outcome.status === 'ok') {
          setExecOutcome({
            status: 'ok',
            raw: outcome.matches,
            truncated: outcome.truncated,
            ...base,
          });
        } else if (outcome.status === 'timeout') {
          setExecOutcome({ status: 'timeout', raw: [], truncated: false, ...base });
          setStatus('Matching took too long and was stopped.');
        } else {
          setExecOutcome({
            status: 'error',
            raw: [],
            truncated: false,
            error: outcome.error,
            ...base,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [execSource, execFlags, deferredText]);

  // `executing` is derived, not stored: a run is in flight whenever the last
  // outcome does not correspond to the current compiled inputs. (Reference
  // equality makes the text comparison O(1) in the common unchanged case.)
  const executing =
    compile.ok &&
    deferredText !== '' &&
    (execOutcome.source !== execSource ||
      execOutcome.flags !== execFlags ||
      execOutcome.text !== deferredText);

  const matchResult = useMemo<MatchResult>(() => {
    if (!compile.ok || deferredText === '') return emptyMatchResult('ok', global, MATCH_CAP);
    if (execOutcome.text === '') return emptyMatchResult('ok', global, MATCH_CAP);
    if (execOutcome.status === 'timeout') return emptyMatchResult('timeout', global, MATCH_CAP);
    if (execOutcome.status === 'error') return emptyMatchResult('ok', global, MATCH_CAP);
    return enrichMatches(execOutcome.raw, {
      text: execOutcome.text,
      groupNamesByNumber: compile.groupNamesByNumber,
      global,
      truncated: execOutcome.truncated,
      cap: MATCH_CAP,
    });
  }, [compile, execOutcome, global, deferredText]);

  // Reset the selected match to the first whenever the result set changes — the
  // "adjust state during render" pattern (a state flag, as elsewhere in Oddments),
  // not an effect.
  const [prevOutcome, setPrevOutcome] = useState(execOutcome);
  if (prevOutcome !== execOutcome) {
    setPrevOutcome(execOutcome);
    if (selectedIndex !== 0) setSelectedIndex(0);
  }

  const matches = matchResult.matches;
  const selected =
    matches.length > 0 ? matches[Math.min(selectedIndex, matches.length - 1)]! : null;

  const explanation = useMemo(() => {
    if (!compile.ok) {
      return {
        status: 'unavailable' as const,
        nodes: [],
        message: 'Fix the pattern above to see its explanation.',
      };
    }
    return explainPattern(pattern, flags);
  }, [compile.ok, pattern, flags]);

  const diagnostics = useMemo(
    () =>
      compile.ok
        ? computeDiagnostics({
            source: compile.source,
            flags: compile.flags,
            canMatchEmpty: compile.canMatchEmpty,
          })
        : [],
    [compile],
  );

  const replacementTokens = useMemo(
    () =>
      compile.ok ? explainReplacement(replacement, compile.groupCount, compile.groupNames) : [],
    [compile, replacement],
  );

  // Replacement runs `String.prototype.replace` on the MAIN thread, so it must
  // only ever run against inputs the worker already proved fast: `execOutcome`
  // holds the exact (source, flags, text) of the last completed run. Using the
  // *current* compiled pattern here would let a freshly-typed catastrophic
  // pattern hang the page before its worker run times out — so we deliberately
  // do not. It is enabled only when a run for the *current* inputs has completed
  // successfully (not while a new run is in flight, and not after a timeout).
  const replacementAvailable =
    !executing && compile.ok && execOutcome.status === 'ok' && deferredText !== '';
  const replacementState: 'ready' | 'computing' | 'stopped' = replacementAvailable
    ? 'ready'
    : !executing && compile.ok && execOutcome.status === 'timeout'
      ? 'stopped'
      : 'computing';
  const replacementResult = useMemo(() => {
    if (!replacementAvailable || replacement === '') return null;
    return applyReplacement({
      source: execOutcome.source,
      flags: execOutcome.flags,
      text: execOutcome.text,
      replacement,
      matchCount: matches.length,
      truncated: matchResult.truncated,
    });
  }, [replacementAvailable, execOutcome, replacement, matches.length, matchResult.truncated]);

  const testResults = useMemo(
    () => (compile.ok ? evaluateTestCases(compile.source, compile.flags, testCases) : []),
    [compile, testCases],
  );

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleToggleFlag = useCallback((id: FlagId) => {
    setFlags((prev) => toggleFlag(prev, id));
  }, []);

  const handleExample = useCallback((example: RegexExample) => {
    setPattern(example.pattern);
    setFlags(example.flags);
    setText(example.text);
    setReplacement(example.replacement ?? '');
    setStatus(`Loaded example: ${example.label}.`);
  }, []);

  const handleImportLiteral = useCallback((literal: LiteralParse) => {
    setPattern(literal.body);
    setFlags(literal.flags);
    setStatus('Split the pasted regex literal into a pattern and flags.');
  }, []);

  const handlePasteText = useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      setText(clip);
      setStatus('Pasted from the clipboard.');
    } catch {
      setStatus('Paste failed — your browser blocked clipboard access.');
    }
  }, []);

  const handleClearText = useCallback(() => {
    setText('');
    setStatus('Cleared the test text.');
  }, []);

  const copyValue = useCallback(async (value: string, label: string) => {
    const ok = await copyToClipboard(value);
    setStatus(ok ? `${label} copied.` : 'Copy failed — your browser blocked clipboard access.');
  }, []);

  const copySummary = useCallback(async () => {
    if (!compile.ok) return;
    const ok = await copyToClipboard(
      toDiagnosticSummary({ compile, matches: matchResult, diagnostics }),
    );
    setStatus(ok ? 'Diagnostic summary copied.' : 'Copy failed.');
  }, [compile, matchResult, diagnostics]);

  const addTestCase = useCallback(() => {
    setTestCases((prev) =>
      prev.length >= MAX_TEST_CASES
        ? prev
        : [...prev, { id: newId(), text: '', expected: 'match' }],
    );
  }, []);

  const updateTestCase = useCallback((id: string, patch: Partial<Omit<TestCase, 'id'>>) => {
    setTestCases((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeTestCase = useCallback((id: string) => {
    setTestCases((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const showInstrument = pattern !== '';

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / regex-workbench
          </p>
          <h1 className={styles.title}>Regex Workbench</h1>
          <p className={styles.subtitle}>
            Understand, test, and refine a regular expression. Enter a pattern and see exactly what
            it&rsquo;s doing — what matched, why it matched, and what the engine actually
            interpreted — with capture groups, zero-width behaviour, a deterministic explanation,
            and a replacement preview.
          </p>
          <p className={styles.premise}>
            <strong>Expose the engine, don&rsquo;t hide it.</strong> When JavaScript&rsquo;s{' '}
            <code>RegExp</code> does something surprising, the workbench shows the surprise rather
            than smoothing it over. Everything runs locally in your browser.
          </p>
          <span className={styles.engineBadge}>
            Engine: JavaScript / ECMAScript <code>RegExp</code>
          </span>
        </header>

        <div className={styles.stack}>
          <PatternPanel
            pattern={pattern}
            onPatternChange={setPattern}
            flags={flags}
            onToggleFlag={handleToggleFlag}
            compile={compile}
            onExample={handleExample}
            onImportLiteral={handleImportLiteral}
            onCopy={copyValue}
          />

          <TextPanel
            text={text}
            onTextChange={setText}
            onPaste={handlePasteText}
            onClear={handleClearText}
          />

          {!showInstrument ? (
            <EmptyState />
          ) : (
            <>
              <MatchSummary
                result={matchResult}
                executing={executing}
                selectedIndex={Math.min(selectedIndex, Math.max(0, matches.length - 1))}
                onSelect={setSelectedIndex}
                onCopySummary={copySummary}
                canCopy={compile.ok}
              />

              <div className={styles.columns}>
                <div className={styles.colStack}>
                  <HighlightedText
                    text={execOutcome.text}
                    result={matchResult}
                    executing={executing}
                    selectedIndex={Math.min(selectedIndex, Math.max(0, matches.length - 1))}
                    onSelect={setSelectedIndex}
                  />
                  <ReplacementPanel
                    replacement={replacement}
                    onReplacementChange={setReplacement}
                    tokens={replacementTokens}
                    result={replacementResult}
                    state={replacementState}
                    onCopy={copyValue}
                  />
                </div>
                <div className={styles.colStack}>
                  <MatchInspector match={selected} onCopy={copyValue} />
                  <ExplanationPanel explanation={explanation} patternEmpty={pattern === ''} />
                  <DiagnosticsPanel diagnostics={diagnostics} />
                </div>
              </div>

              <TestCasesPanel
                cases={testCases}
                results={testResults}
                compileOk={compile.ok}
                onAdd={addTestCase}
                onUpdate={updateTestCase}
                onRemove={removeTestCase}
              />
            </>
          )}
        </div>

        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
