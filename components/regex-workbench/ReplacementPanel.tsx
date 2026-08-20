'use client';

import type { ReplacementResult, ReplacementToken } from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  replacement: string;
  onReplacementChange: (value: string) => void;
  tokens: ReplacementToken[];
  result: ReplacementResult | null;
  /**
   * `ready` — a completed run backs the preview; `computing` — a run is in flight;
   * `stopped` — matching timed out, so a preview would be misleading.
   */
  state: 'ready' | 'computing' | 'stopped';
  onCopy: (text: string, label: string) => void;
}

const INERT = new Set(['unknown-group', 'unknown-named']);
const ACTIVE = new Set(['match', 'group', 'named', 'prefix', 'suffix', 'literal-dollar']);

export function ReplacementPanel({
  replacement,
  onReplacementChange,
  tokens,
  result,
  state,
  onCopy,
}: Props) {
  const showTokens = replacement !== '' && tokens.some((t) => t.kind !== 'text');

  return (
    <section className={styles.panel} aria-label="Replacement preview">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Replacement <span className={styles.panelHint}>· JavaScript replace()</span>
        </h2>
        {result && result.changed && (
          <button
            type="button"
            className={styles.copyBtn}
            onClick={() => onCopy(result.output, 'Replacement result')}
          >
            Copy result
          </button>
        )}
      </div>
      <div className={styles.panelBody}>
        <label className={styles.patternField}>
          <span className={styles.fieldLabel}>Replacement string</span>
          <input
            type="text"
            className={styles.replaceInput}
            value={replacement}
            onChange={(event) => onReplacementChange(event.target.value)}
            placeholder="$<last>, $<first>   ·   [$&]   ·   $1"
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            aria-label="Replacement string"
          />
        </label>

        {showTokens && (
          <div className={styles.replaceTokens} aria-label="Replacement tokens">
            {tokens
              .filter((token) => token.kind !== 'text')
              .map((token, index) => (
                <span
                  key={index}
                  className={`${styles.token} ${
                    INERT.has(token.kind)
                      ? styles.tokenInert
                      : ACTIVE.has(token.kind)
                        ? styles.tokenActive
                        : ''
                  }`}
                  title={token.detail}
                >
                  <strong>{token.raw}</strong> {token.detail}
                </span>
              ))}
          </div>
        )}

        {replacement === '' ? (
          <p className={styles.replaceMeta}>
            Enter a replacement to preview the result. Tokens like{' '}
            <code className={styles.inlineCode}>$&amp;</code>,{' '}
            <code className={styles.inlineCode}>$1</code>,{' '}
            <code className={styles.inlineCode}>$&lt;name&gt;</code>,{' '}
            <code className={styles.inlineCode}>$`</code>,{' '}
            <code className={styles.inlineCode}>$&apos;</code> and{' '}
            <code className={styles.inlineCode}>$$</code> behave exactly as JavaScript defines them.
          </p>
        ) : state === 'stopped' ? (
          <p className={styles.replaceMeta}>
            The preview is unavailable because matching was stopped for this input.
          </p>
        ) : state === 'computing' ? (
          <p className={styles.replaceMeta}>Updating the preview…</p>
        ) : result ? (
          <>
            <pre className={styles.replaceOutput} aria-label="Replacement result">
              {result.output === '' ? ' ' : result.output}
            </pre>
            <p className={styles.replaceMeta}>
              {result.changed
                ? `${result.count.toLocaleString()} ${
                    result.count === 1 ? 'replacement' : 'replacements'
                  } · ${result.global ? 'all matches (g)' : 'first match only'}`
                : 'No change — the pattern matched nothing to replace.'}
            </p>
          </>
        ) : null}
      </div>
    </section>
  );
}
