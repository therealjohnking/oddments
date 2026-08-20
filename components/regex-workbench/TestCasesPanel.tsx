'use client';

import {
  MAX_TEST_CASES,
  type TestCase,
  type TestCaseResult,
  type TestExpectation,
} from '@/lib/regex-workbench';
import styles from './regex-workbench.module.css';

interface Props {
  cases: TestCase[];
  results: TestCaseResult[];
  compileOk: boolean;
  onAdd: () => void;
  onUpdate: (id: string, patch: Partial<Omit<TestCase, 'id'>>) => void;
  onRemove: (id: string) => void;
}

export function TestCasesPanel({ cases, results, compileOk, onAdd, onUpdate, onRemove }: Props) {
  const resultById = new Map(results.map((r) => [r.id, r]));
  const passing = results.filter((r) => r.pass).length;

  return (
    <section className={styles.panel} aria-label="Test cases">
      <div className={styles.panelHead}>
        <h2 className={styles.panelTitle}>
          Test cases <span className={styles.panelHint}>· expectations for this pattern</span>
        </h2>
        {cases.length > 0 && compileOk && (
          <span className={styles.panelHint}>
            {passing} / {cases.length} passing
          </span>
        )}
      </div>
      <div className={styles.panelBody}>
        <p className={styles.caseSummary}>
          Add short strings and whether they <em>should</em> match. The workbench checks each
          against the current pattern as you edit — a lightweight way to pin down what you mean.
          Nothing here is saved.
        </p>

        {cases.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className={styles.casesTable}>
              <thead>
                <tr>
                  <th style={{ width: '55%' }}>Text</th>
                  <th>Expected</th>
                  <th>Result</th>
                  <th aria-label="Remove" />
                </tr>
              </thead>
              <tbody>
                {cases.map((testCase) => {
                  const result = resultById.get(testCase.id);
                  return (
                    <tr key={testCase.id}>
                      <td>
                        <input
                          type="text"
                          className={styles.caseText}
                          value={testCase.text}
                          spellCheck={false}
                          autoCapitalize="off"
                          autoCorrect="off"
                          aria-label="Test text"
                          onChange={(event) => onUpdate(testCase.id, { text: event.target.value })}
                        />
                      </td>
                      <td>
                        <select
                          className={styles.caseSelect}
                          value={testCase.expected}
                          aria-label="Expected result"
                          onChange={(event) =>
                            onUpdate(testCase.id, {
                              expected: event.target.value as TestExpectation,
                            })
                          }
                        >
                          <option value="match">match</option>
                          <option value="no-match">no match</option>
                        </select>
                      </td>
                      <td>
                        {!compileOk ? (
                          <span className={styles.panelHint}>—</span>
                        ) : result ? (
                          <span className={styles.casePass} data-pass={result.pass}>
                            {result.pass ? '✓ pass' : '✗ fail'}
                            <span className={styles.panelHint}>
                              {' '}
                              ({result.matched ? 'matched' : 'no match'})
                            </span>
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <button
                          type="button"
                          className={styles.copyBtn}
                          aria-label="Remove this test case"
                          onClick={() => onRemove(testCase.id)}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className={styles.toolbar} style={{ marginTop: '0.85rem' }}>
          <button
            type="button"
            className={styles.btn}
            onClick={onAdd}
            disabled={cases.length >= MAX_TEST_CASES}
          >
            + Add test case
          </button>
          {cases.length >= MAX_TEST_CASES && (
            <span className={styles.panelHint}>Maximum of {MAX_TEST_CASES} rows.</span>
          )}
        </div>
      </div>
    </section>
  );
}
