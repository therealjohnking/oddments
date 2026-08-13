/**
 * Slopometer's single entry point: turn raw text into a deterministic Analysis.
 *
 * The pipeline is intentionally boring and inspectable:
 *   1. tokenize (words, sentences, paragraphs, lines) without mutating the input
 *   2. run every rule independently against that shared context
 *   3. round and sum each rule's capped contribution → score (clamped to 100)
 *   4. map the score to a band and roll findings up per category
 *
 * There is no hidden state, no randomness, and no model — the same input always
 * produces the same Analysis.
 */

import { RULES, SLOP_CATEGORIES, type RuleContext } from './rules';
import { scoreToBand } from './score';
import {
  countCodePoints,
  countWords,
  documentSentences,
  normalizeForMatch,
  splitLines,
  splitParagraphs,
} from './text';
import type { Analysis, CategoryContribution, Finding, SlopCategoryId, TextMetrics } from './types';

/** Below this word count, structural analysis is unreliable; we say so. */
export const SHORT_TEXT_WORDS = 25;

export interface AnalyzeOptions {
  /** Cap on characters actually scanned by the rules (counts stay bounded). */
  maxScanChars?: number;
}

const DEFAULT_MAX_SCAN_CHARS = 200_000;

function emptyMetrics(): TextMetrics {
  return { characters: 0, words: 0, sentences: 0, paragraphs: 0, lines: 0 };
}

function emptyAnalysis(): Analysis {
  return {
    isEmpty: true,
    tooShort: false,
    score: 0,
    rawScore: 0,
    scoreCapped: false,
    band: scoreToBand(0),
    metrics: emptyMetrics(),
    findings: [],
    categoryContributions: [],
  };
}

export function analyzeText(input: string, options: AnalyzeOptions = {}): Analysis {
  if (input.trim().length === 0) return emptyAnalysis();

  const maxScanChars = options.maxScanChars ?? DEFAULT_MAX_SCAN_CHARS;
  const text = input.length > maxScanChars ? input.slice(0, maxScanChars) : input;
  const matchText = normalizeForMatch(text);

  const paragraphs = splitParagraphs(text);
  const sentences = documentSentences(paragraphs);
  const lines = splitLines(text);
  const words = countWords(text);

  const metrics: TextMetrics = {
    characters: countCodePoints(text),
    words,
    sentences: sentences.length,
    paragraphs: paragraphs.length,
    lines: lines.length,
  };

  const ctx: RuleContext = { text, matchText, metrics, words, sentences, paragraphs, lines };

  const findings: Finding[] = [];
  let rawScore = 0;
  for (const rule of RULES) {
    const result = rule.detect(ctx);
    if (!result || result.points <= 0) continue;
    const contribution = Math.round(result.points);
    if (contribution <= 0) continue;
    rawScore += contribution;
    findings.push({
      ruleId: result.ruleId,
      category: result.category,
      title: result.title,
      explanation: result.explanation,
      occurrences: result.occurrences,
      contribution,
      atCap: result.atCap,
      evidence: result.evidence,
      detail: result.detail,
      evidenceTruncated: result.evidenceTruncated,
    });
  }

  findings.sort((a, b) => b.contribution - a.contribution || a.title.localeCompare(b.title));

  const score = Math.min(100, rawScore);

  const byCategory = new Map<SlopCategoryId, CategoryContribution>();
  for (const finding of findings) {
    const existing = byCategory.get(finding.category);
    if (existing) {
      existing.contribution += finding.contribution;
      existing.findingCount += 1;
    } else {
      byCategory.set(finding.category, {
        category: finding.category,
        label: SLOP_CATEGORIES[finding.category].label,
        contribution: finding.contribution,
        findingCount: 1,
      });
    }
  }
  const categoryContributions = [...byCategory.values()].sort(
    (a, b) => b.contribution - a.contribution || a.label.localeCompare(b.label),
  );

  return {
    isEmpty: false,
    tooShort: words < SHORT_TEXT_WORDS,
    score,
    rawScore,
    scoreCapped: rawScore > 100,
    band: scoreToBand(score),
    metrics,
    findings,
    categoryContributions,
  };
}
