'use client';

import { useId, useRef, useState, type DragEvent } from 'react';
import { formatBytes } from '@/lib/json-crime-scene';
import styles from './jcs.module.css';

interface Props {
  hasData: boolean;
  fileName: string | null;
  fileSize: number | null;
  statusLabel: string | null;
  statusOk: boolean;
  pasteValue: string;
  large: boolean;
  error: string | null;
  onFile: (file: File) => void;
  onPasteChange: (text: string) => void;
  onSample: () => void;
  onClear: () => void;
}

export function SourcePanel({
  hasData,
  fileName,
  fileSize,
  statusLabel,
  statusOk,
  pasteValue,
  large,
  error,
  onFile,
  onPasteChange,
  onSample,
  onClear,
}: Props) {
  const [dragging, setDragging] = useState(false);
  const [showPaste, setShowPaste] = useState(false);
  const inputId = useId();
  const pasteId = useId();
  const dropRef = useRef<HTMLDivElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  const fileButton = (
    <>
      <input
        id={inputId}
        type="file"
        accept=".json,application/json,text/json,text/plain"
        className={styles.fileInput}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
      />
      <label htmlFor={inputId} className={`${styles.btn} ${styles.fileLabel}`}>
        {hasData ? 'Choose another file' : 'Choose JSON file'}
      </label>
    </>
  );

  return (
    <section aria-label="JSON source">
      {hasData ? (
        <div className={styles.sourceBar}>
          <span className={styles.sourceName}>{fileName ?? 'Pasted JSON'}</span>
          <span className={styles.sourceMeta}>
            {fileSize !== null
              ? formatBytes(fileSize)
              : `${pasteValue.length.toLocaleString()} chars`}
          </span>
          {statusLabel && (
            <span className={`${styles.statusOk} ${statusOk ? '' : styles.statusBad}`}>
              <span aria-hidden="true">{statusOk ? '●' : '▲'}</span>
              {statusLabel}
            </span>
          )}
          <span className={styles.spacer} />
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
          ref={dropRef}
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
            {'{ }'}
          </span>
          <p className={styles.dropTitle}>Drop a .json file here</p>
          <p className={styles.dropHint}>
            or choose one, or paste text — it never leaves your browser.
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
          <span className={styles.pasteLabel}>Paste or edit JSON text</span>
          <textarea
            id={pasteId}
            className={styles.textarea}
            value={pasteValue}
            onChange={(event) => onPasteChange(event.target.value)}
            placeholder={'{\n  "hello": "world",\n  "items": [1, 2, 3]\n}'}
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
          This document is large, so analysis may take a moment. Everything still runs locally.
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
