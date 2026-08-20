/**
 * The test-case bench: evaluate short "should this match?" rows against the
 * current pattern, turning the tester into a lightweight development instrument.
 *
 * Rows are short, user-authored, and bounded in count and length, so evaluation
 * runs synchronously with a non-global probe regex (`g`/`y` stripped so a shared
 * `lastIndex` can't skew a `.test`). It is deliberately not a testing framework:
 * no saved suites, no persistence of row text, no import/export ceremony.
 */

import { canonicalizeFlags } from './flags';
import type { TestCase, TestCaseResult } from './types';

/** Maximum rows the bench holds — an instrument, not a suite runner. */
export const MAX_TEST_CASES = 20;
/** Per-row text cap; rows are meant to be small examples. */
export const MAX_TEST_CASE_LENGTH = 2000;

/** Does the pattern find a match anywhere in `text`? Non-global, side-effect-free. */
export function patternMatches(source: string, flags: string, text: string): boolean {
  try {
    const probe = new RegExp(source, canonicalizeFlags(flags).replace(/[gy]/g, ''));
    return probe.test(text);
  } catch {
    return false;
  }
}

export function evaluateTestCases(
  source: string,
  flags: string,
  cases: TestCase[],
): TestCaseResult[] {
  return cases.map((testCase) => {
    const matched = patternMatches(source, flags, testCase.text.slice(0, MAX_TEST_CASE_LENGTH));
    const pass = matched === (testCase.expected === 'match');
    return { id: testCase.id, matched, pass };
  });
}
