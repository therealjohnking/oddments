'use client';

import { useMemo } from 'react';
import {
  EXAMPLES,
  parseLiteral,
  toRegexLiteral,
  type CompileResult,
  type FlagId,
  type LiteralParse,
  type RegexExample,
} from '@/lib/regex-workbench';
import { FlagsControl } from './FlagsControl';
import styles from './regex-workbench.module.css';

interface Props {
  pattern: string;
  onPatternChange: (value: string) => void;
  flags: string;
  onToggleFlag: (id: FlagId) => void;
  compile: CompileResult;
  onExample: (example: RegexExample) => void;
  onImportLiteral: (literal: LiteralParse) => void;
  onCopy: (text: string, label: string) => void;
}

export function PatternPanel({
  pattern,
  onPatternChange,
  flags,
  onToggleFlag,
  compile,
  onExample,
  onImportLiteral,
  onCopy,
}: Props) {
  // Offer to split a pasted /body/flags literal — explicit, never automatic.
  const literal = useMemo<LiteralParse | null>(
    () => (pattern.trim().startsWith('/') ? parseLiteral(pattern) : null),
    [pattern],
  );

  return (
    <section className={styles.panel} aria-label="Pattern">
      <div className={styles.panelBody}>
        <label className={styles.patternField}>
          <span className={styles.fieldLabel}>Pattern (JavaScript RegExp)</span>
          <div className={styles.patternWrap} data-invalid={!compile.ok}>
            <span className={styles.slash} aria-hidden="true">
              /
            </span>
            <input
              type="text"
              className={styles.patternInput}
              value={pattern}
              onChange={(event) => onPatternChange(event.target.value)}
              placeholder="(?<area>\d{3})[-.\s](?<line>\d{4})"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              aria-label="Regular expression pattern body"
              aria-invalid={!compile.ok}
              aria-describedby="rw-pattern-help"
            />
            <span
              className={`${styles.flagsSuffix} ${flags ? '' : styles.flagsSuffixEmpty}`}
              aria-hidden="true"
            >
              /{flags || 'flags'}
            </span>
          </div>
        </label>

        {literal && (
          <div className={styles.toolbar} style={{ marginTop: '0.5rem' }}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnGhost}`}
              onClick={() => onImportLiteral(literal)}
            >
              Split into pattern <code className={styles.inlineCode}>{literal.body}</code> + flags{' '}
              <code className={styles.inlineCode}>{literal.flags || '∅'}</code>
            </button>
          </div>
        )}

        <div className={styles.flagsRow} style={{ marginTop: '0.85rem' }}>
          <FlagsControl flags={flags} onToggle={onToggleFlag} />
        </div>

        {!compile.ok && pattern !== '' && (
          <div className={styles.errorBox} role="alert" style={{ marginTop: '0.85rem' }}>
            <p className={styles.errorTitle}>This pattern doesn&rsquo;t compile</p>
            <p className={styles.errorMsg}>{compile.message}</p>
            {compile.hint && <p className={styles.errorHint}>{compile.hint}</p>}
          </div>
        )}

        <div className={styles.examples}>
          <span className={styles.examplesLabel}>Examples:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example.id}
              type="button"
              className={styles.exampleChip}
              onClick={() => onExample(example)}
              title={example.blurb}
            >
              {example.label}
            </button>
          ))}
        </div>

        {compile.ok && pattern !== '' && (
          <div className={styles.copyRow}>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={() => onCopy(toRegexLiteral(compile.source, compile.flags), 'Regex literal')}
            >
              Copy /…/flags
            </button>
            <button
              type="button"
              className={styles.copyBtn}
              onClick={() => onCopy(compile.source, 'Pattern body')}
            >
              Copy body
            </button>
          </div>
        )}

        <p id="rw-pattern-help" className={styles.help}>
          Enter the pattern body only — the slashes and flags are shown around it. Regex syntax
          varies by engine; this workbench uses JavaScript&rsquo;s <code>RegExp</code>. Everything
          runs locally, and your pattern is never saved.
        </p>
      </div>
    </section>
  );
}
