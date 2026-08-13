import { describe, expect, it } from 'vitest';
import { analyzeText } from './analyze';
import { CLEAN_SAMPLE, SLOP_SAMPLE } from './text-samples';

describe('analyzeText — empty and tiny input', () => {
  it('reports an empty analysis for empty or whitespace-only input', () => {
    for (const input of ['', '   ', '\n\n\t ']) {
      const a = analyzeText(input);
      expect(a.isEmpty).toBe(true);
      expect(a.score).toBe(0);
      expect(a.findings).toHaveLength(0);
      expect(a.band.id).toBe('human');
    }
  });

  it('flags short samples as too short for structural analysis', () => {
    const a = analyzeText('Circle back and leverage the synergy.');
    expect(a.isEmpty).toBe(false);
    expect(a.tooShort).toBe(true);
  });

  it('does not treat a normal paragraph as too short', () => {
    expect(analyzeText(CLEAN_SAMPLE).tooShort).toBe(false);
  });
});

describe('analyzeText — reference samples', () => {
  it('scores plain human prose low', () => {
    const a = analyzeText(CLEAN_SAMPLE);
    expect(a.score).toBeLessThan(15);
    expect(a.band.id).toBe('human');
  });

  it('scores atrocious thought-leadership in the top band', () => {
    const a = analyzeText(SLOP_SAMPLE);
    expect(a.score).toBeGreaterThanOrEqual(70);
    expect(a.band.id).toBe('thought-leadership');
    // The signature crimes all show up.
    const ruleIds = a.findings.map((f) => f.ruleId);
    for (const expected of [
      'canned-openers',
      'audience-commands',
      'contrast-template',
      'corporate-jargon',
      'content-cliches',
    ]) {
      expect(ruleIds).toContain(expected);
    }
  });
});

describe('analyzeText — scoring invariants', () => {
  it('is deterministic', () => {
    const a = analyzeText(SLOP_SAMPLE);
    const b = analyzeText(SLOP_SAMPLE);
    expect(a).toEqual(b);
  });

  it('sorts findings by contribution, descending', () => {
    const { findings } = analyzeText(SLOP_SAMPLE);
    for (let i = 1; i < findings.length; i++) {
      expect(findings[i - 1]!.contribution).toBeGreaterThanOrEqual(findings[i]!.contribution);
    }
  });

  it('caps the score at 100 and records that it clamped', () => {
    const maximal = [
      "Here's the thing. The truth is this. Let me be clear. Make no mistake.",
      'Read that again. Let that sink in. Save this for later. Bookmark this.',
      'Circle back, boil the ocean, north star, low-hanging fruit, thought leadership, deep dive, synergy, table stakes.',
      'Game changer. Unlock your potential. Secret sauce. Trust the process. Dream big. Stay hungry. Food for thought.',
      "It's not X. It's Y. This is not A, but B. It's not about C, it's about D. Not P, but Q.",
      'Wow! Amazing! Huge! Incredible! Massive! Great! Best! Win! Now! More!',
      'a — b — c — d — e — f — g — h — i — j — k',
      'one... two... three... four... five... six... seven...',
      '🚀 🔥 💡 🙌 ✨ 🎯 📈 💪 🌟 ⭐ 🎉',
      'THIS IS HUGE MASSIVE ENORMOUS GIGANTIC TERRIBLE SHOUTY LOUD NOISY WORDS',
    ].join('\n\n');
    const a = analyzeText(maximal);
    expect(a.rawScore).toBeGreaterThan(100);
    expect(a.score).toBe(100);
    expect(a.scoreCapped).toBe(true);
    expect(a.band.id).toBe('thought-leadership');
  });

  it('rolls contributions up per category, and the totals reconcile', () => {
    const a = analyzeText(SLOP_SAMPLE);
    const summed = a.categoryContributions.reduce((total, c) => total + c.contribution, 0);
    const findingsTotal = a.findings.reduce((total, f) => total + f.contribution, 0);
    expect(summed).toBe(findingsTotal);
    expect(a.rawScore).toBe(findingsTotal);
    for (let i = 1; i < a.categoryContributions.length; i++) {
      expect(a.categoryContributions[i - 1]!.contribution).toBeGreaterThanOrEqual(
        a.categoryContributions[i]!.contribution,
      );
    }
  });
});

describe('analyzeText — evidence offsets', () => {
  it('every evidence range slices back to real text in the original input', () => {
    const a = analyzeText(SLOP_SAMPLE);
    let checked = 0;
    for (const finding of a.findings) {
      for (const ev of finding.evidence) {
        expect(ev.start).toBeGreaterThanOrEqual(0);
        expect(ev.end).toBeLessThanOrEqual(SLOP_SAMPLE.length);
        expect(ev.end).toBeGreaterThan(ev.start);
        // The slice is non-empty real text (excerpt may add context/collapse space).
        expect(SLOP_SAMPLE.slice(ev.start, ev.end).length).toBe(ev.end - ev.start);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});
