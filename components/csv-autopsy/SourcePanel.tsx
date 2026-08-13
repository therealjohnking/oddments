'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/lib/csv-autopsy';
import styles from './csv-autopsy.module.css';

export type HeaderMode = 'auto' | 'header' | 'no-header';

interface Props {
  hasData: boolean;
  fileName: string | null;
  fileSize: number | null;
  rows: number | null;
  columns: number | null;
  headerMode: HeaderMode;
  pasteValue: string;
  large: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onPasteChange: (text: string) => void;
  onSample: () => void;
  onClear: () => void;
  onHeaderMode: (mode: HeaderMode) => void;
}

export function SourcePanel({
  hasData,
  fileName,
  fileSize,
  rows,
  columns,
  headerMode,
  pasteValue,
  large,
  error,
  onFile,
  onPasteChange,
  onSample,
  onClear,
  onHeaderMode,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const pasteId = useId();

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const fileButton = (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept=".csv,.tsv,.txt,text/csv,text/tab-separated-values,text/plain"
        className={styles.fileInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <label htmlFor={inputId} className={`${styles.btn} ${styles.fileLabel}`}>
        <span className={styles.fileLabelText}>
          {hasData ? 'Choose another file' : 'Choose CSV file'}
        </span>
      </label>
    </>
  );

  return (
    <section aria-label="Data source">
      {hasData ? (
        <div className={styles.sourceBar}>
          <span className={styles.sourceName}>{fileName ?? 'Pasted CSV'}</span>
          <span className={styles.sourceMeta}>
            {fileSize !== null ? `${formatBytes(fileSize)} · ` : ''}
            {rows !== null ? `${rows.toLocaleString()} rows` : ''}
            {columns !== null ? ` × ${columns.toLocaleString()} cols` : ''}
          </span>
          <span className={styles.spacer} />
          <label className={styles.headerControl}>
            Header
            <select
              className={styles.select}
              value={headerMode}
              onChange={(event) => onHeaderMode(event.target.value as HeaderMode)}
            >
              <option value="auto">Auto-detect</option>
              <option value="header">First row is header</option>
              <option value="no-header">No header</option>
            </select>
          </label>
          {fileButton}
          <button type="button" className={styles.btn} onClick={onSample}>
            Sample
          </button>
          <button
            type="button"
            className={styles.btn}
            aria-expanded={showPaste}
            onClick={() => setShowPaste((v) => !v)}
          >
            {showPaste ? 'Hide text' : 'Paste / edit text'}
          </button>
          <button type="button" className={`${styles.btn} ${styles.btnGhost}`} onClick={onClear}>
            Clear
          </button>
        </div>
      ) : (
        <div
          className={styles.dropzone}
          data-dragging={dragging}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={handleDrop}
        >
          <span className={styles.dropIcon} aria-hidden="true">
            ⌸
          </span>
          <p className={styles.dropTitle}>Drop a CSV file here</p>
          <p className={styles.dropHint}>
            or choose one, or paste the text — it never leaves your browser.
          </p>
          <div className={styles.dropActions}>
            {fileButton}
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={onSample}
            >
              Load sample
            </button>
            <button
              type="button"
              className={styles.btn}
              aria-expanded={showPaste}
              onClick={() => setShowPaste((v) => !v)}
            >
              {showPaste ? 'Hide paste box' : 'Paste text'}
            </button>
          </div>
        </div>
      )}

      {showPaste && (
        <label className={styles.pasteField} htmlFor={pasteId}>
          <span className={styles.pasteLabel}>Paste or edit CSV text</span>
          <textarea
            id={pasteId}
            className={styles.textarea}
            value={pasteValue}
            onChange={(event) => onPasteChange(event.target.value)}
            placeholder={'name,amount,date\nAda,1200,2026-01-15\nGrace,980,2026-02-03'}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            wrap="off"
          />
        </label>
      )}

      {large && (
        <p className={styles.warnBanner} role="status">
          This file is large, so analysis may take a moment. Everything still runs locally.
        </p>
      )}
      {error && (
        <p className={styles.errorBanner} role="alert">
          {error}
        </p>
      )}

      {!hasData && (
        <p className={styles.localNote}>
          <span aria-hidden="true">🔒</span> Files are read in your browser only — nothing is
          uploaded.
        </p>
      )}
    </section>
  );
}
