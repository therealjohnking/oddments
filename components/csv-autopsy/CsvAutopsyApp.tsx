'use client';

import Link from 'next/link';
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeCsv,
  SAMPLE_CSV,
  SAMPLE_FILENAME,
  toJsonReport,
  toMarkdownReport,
} from '@/lib/csv-autopsy';
import { ColumnsPanel } from './ColumnsPanel';
import { EmptyState } from './EmptyState';
import { FindingsPanel } from './FindingsPanel';
import { OverviewPanel } from './OverviewPanel';
import { PreviewPanel } from './PreviewPanel';
import { SourcePanel, type HeaderMode } from './SourcePanel';
import { copyToClipboard } from './clipboard';
import { downloadText } from './download';
import styles from './csv-autopsy.module.css';

/** Refuse files above this size — analyzing them could lock the tab. */
const HARD_MAX_BYTES = 50 * 1024 * 1024;

interface Source {
  text: string;
  fileName: string | null;
  fileSize: number | null;
}

const EMPTY_SOURCE: Source = { text: '', fileName: null, fileSize: null };

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

function baseName(fileName: string | null): string {
  if (!fileName) return 'csv-autopsy';
  const withoutExt = fileName.replace(/\.[^.]+$/, '');
  return withoutExt.length > 0 ? withoutExt : 'csv-autopsy';
}

export function CsvAutopsyApp() {
  const [source, setSource] = useState<Source>(EMPTY_SOURCE);
  const [headerMode, setHeaderMode] = useState<HeaderMode>('auto');
  const [openColumns, setOpenColumns] = useState<Set<number>>(new Set());
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scrollTick, setScrollTick] = useState(0);
  const pendingScroll = useRef<string | null>(null);

  const deferredText = useDeferredValue(source.text);
  const analysis = useMemo(
    () =>
      analyzeCsv(deferredText, {
        fileName: source.fileName,
        fileSize: source.fileSize,
        headerMode,
      }),
    [deferredText, source.fileName, source.fileSize, headerMode],
  );

  useEffect(() => {
    const target = pendingScroll.current;
    if (!target) return;
    const el = document.getElementById(target);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    pendingScroll.current = null;
  }, [scrollTick]);

  const handleFile = useCallback((file: File) => {
    if (file.size > HARD_MAX_BYTES) {
      setError(
        `“${file.name}” is over 50 MB — too large to analyze safely in the browser. Try a smaller export or a sample of the rows.`,
      );
      return;
    }
    setError(null);
    setStatus(`Reading ${file.name}…`);
    const reader = new FileReader();
    reader.onload = () => {
      setOpenColumns(new Set());
      setSource({ text: String(reader.result ?? ''), fileName: file.name, fileSize: file.size });
      setStatus(`Loaded ${file.name}.`);
    };
    reader.onerror = () => setError('Could not read that file.');
    reader.readAsText(file);
  }, []);

  const handlePasteChange = useCallback((text: string) => {
    setError(null);
    setSource({ text, fileName: null, fileSize: null });
  }, []);

  const handleSample = useCallback(() => {
    setError(null);
    setOpenColumns(new Set());
    setSource({ text: SAMPLE_CSV, fileName: SAMPLE_FILENAME, fileSize: SAMPLE_CSV.length });
    setStatus('Loaded the sample dataset.');
  }, []);

  const handleClear = useCallback(() => {
    setError(null);
    setOpenColumns(new Set());
    setSource(EMPTY_SOURCE);
    setStatus('Cleared.');
  }, []);

  const focusColumn = useCallback((index: number) => {
    setOpenColumns((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
    pendingScroll.current = `csv-col-${index}`;
    setScrollTick((tick) => tick + 1);
  }, []);

  const toggleColumn = useCallback((index: number, open: boolean) => {
    setOpenColumns((prev) => {
      if (prev.has(index) === open) return prev;
      const next = new Set(prev);
      if (open) next.add(index);
      else next.delete(index);
      return next;
    });
  }, []);

  const copyReport = useCallback(async () => {
    const ok = await copyToClipboard(toMarkdownReport(analysis));
    setStatus(
      ok
        ? 'Diagnostic report copied to the clipboard.'
        : 'Copy failed — your browser blocked clipboard access.',
    );
  }, [analysis]);

  const downloadMarkdown = useCallback(() => {
    const ok = downloadText(
      `${baseName(source.fileName)}-autopsy.md`,
      toMarkdownReport(analysis),
      'text/markdown',
    );
    setStatus(ok ? 'Markdown report downloaded.' : 'Download failed.');
  }, [analysis, source.fileName]);

  const downloadJson = useCallback(() => {
    const ok = downloadText(
      `${baseName(source.fileName)}-autopsy.json`,
      toJsonReport(analysis),
      'application/json',
    );
    setStatus(ok ? 'JSON report downloaded.' : 'Download failed.');
  }, [analysis, source.fileName]);

  const hasData = source.text.length > 0;
  const showResults =
    hasData && !analysis.isEmpty && !analysis.hadError && analysis.columns.length > 0;

  return (
    <div className="container">
      <div className={styles.tool}>
        <header className={styles.toolHeader}>
          <p className={styles.breadcrumb}>
            <Link href="/">oddments</Link> / csv-autopsy
          </p>
          <h1 className={styles.title}>CSV Autopsy</h1>
          <p className={styles.subtitle}>
            A local-first CSV profiler and diagnostic instrument. Give it a file or paste some text,
            and it tells you what is actually in the data — structure, inferred types, and anything
            that looks suspicious — with a plain-language reason for every finding.
          </p>
          <p className={styles.premise}>
            <strong>Inspect first. Fix deliberately.</strong> CSV Autopsy diagnoses and explains; it
            never repairs, normalizes, or rewrites your data. Everything runs in your browser.
          </p>
        </header>

        <SourcePanel
          hasData={hasData}
          fileName={source.fileName}
          fileSize={source.fileSize}
          rows={showResults ? analysis.overview.rows : null}
          columns={showResults ? analysis.overview.columns : null}
          headerMode={headerMode}
          pasteValue={source.text}
          large={hasData && analysis.meta.large}
          error={error}
          onFile={handleFile}
          onPasteChange={handlePasteChange}
          onSample={handleSample}
          onClear={handleClear}
          onHeaderMode={setHeaderMode}
        />

        {showResults ? (
          <div className={styles.stack}>
            <OverviewPanel overview={analysis.overview} />
            <div className={styles.results}>
              <div className={styles.main}>
                <FindingsPanel
                  findings={analysis.findings}
                  onCopyReport={copyReport}
                  onDownloadMarkdown={downloadMarkdown}
                  onDownloadJson={downloadJson}
                  onFocusColumn={focusColumn}
                />
              </div>
              <div className={styles.side}>
                <ColumnsPanel
                  columns={analysis.columns}
                  findings={analysis.findings}
                  openColumns={openColumns}
                  onToggleColumn={toggleColumn}
                />
              </div>
            </div>
            <PreviewPanel preview={analysis.preview} />
          </div>
        ) : hasData && !error ? (
          <div className={styles.stack}>
            <p className={styles.warnBanner} role="status">
              No tabular data found — the text does not appear to contain any rows or columns.
            </p>
          </div>
        ) : (
          <div className={styles.stack}>
            <EmptyState onSample={handleSample} />
          </div>
        )}

        <p className="visually-hidden" role="status" aria-live="polite">
          {status}
        </p>
      </div>
    </div>
  );
}
