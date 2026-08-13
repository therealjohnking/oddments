import { describe, expect, it } from 'vitest';
import { BANDS, densityPoints, occurrencePoints, ratioPoints, scoreToBand } from './score';

describe('occurrencePoints', () => {
  it('scores linearly per occurrence up to a cap', () => {
    expect(occurrencePoints(0, 3, 12)).toEqual({ points: 0, atCap: false });
    expect(occurrencePoints(3, 3, 12)).toEqual({ points: 9, atCap: false });
    expect(occurrencePoints(4, 3, 12)).toEqual({ points: 12, atCap: true });
    expect(occurrencePoints(10, 3, 12)).toEqual({ points: 12, atCap: true });
  });
});

describe('densityPoints', () => {
  it('grants a length-proportional free allowance and scores only the excess', () => {
    // 4 words → allowance ≈ 0.03; nearly all 3 occurrences are excess.
    const short = densityPoints(3, 4, 140, 1, 8);
    expect(short.points).toBeGreaterThan(2.5);

    // Same 3 occurrences in 600 words → allowance ≈ 4.3, so none are excess.
    const long = densityPoints(3, 600, 140, 1, 8);
    expect(long.points).toBe(0);
  });

  it('caps and reports zero for no occurrences', () => {
    expect(densityPoints(0, 100, 140, 1, 8)).toEqual({ points: 0, atCap: false });
    expect(densityPoints(1000, 10, 140, 1, 8).atCap).toBe(true);
  });
});

describe('ratioPoints', () => {
  it('scores a proportion above a threshold, then caps', () => {
    expect(ratioPoints(0.1, 0.15, 20, 12)).toEqual({ points: 0, atCap: false });
    expect(ratioPoints(0.5, 0.35, 20, 12).points).toBeCloseTo(3, 5);
    expect(ratioPoints(1, 0.35, 20, 12)).toEqual({ points: 12, atCap: true });
  });
});

describe('bands', () => {
  it('cover 0–100 contiguously with no gaps or overlaps', () => {
    expect(BANDS[0]!.min).toBe(0);
    expect(BANDS[BANDS.length - 1]!.max).toBe(100);
    for (let i = 1; i < BANDS.length; i++) {
      expect(BANDS[i]!.min).toBe(BANDS[i - 1]!.max + 1);
    }
  });

  it('maps scores to the right band', () => {
    expect(scoreToBand(0).id).toBe('human');
    expect(scoreToBand(19).id).toBe('human');
    expect(scoreToBand(20).id).toBe('linkedin');
    expect(scoreToBand(39).id).toBe('linkedin');
    expect(scoreToBand(40).id).toBe('content');
    expect(scoreToBand(69).id).toBe('content');
    expect(scoreToBand(70).id).toBe('thought-leadership');
    expect(scoreToBand(100).id).toBe('thought-leadership');
  });

  it('never claims a machine wrote the text', () => {
    const copy = BANDS.map((b) => `${b.label} ${b.blurb}`.toLowerCase()).join(' ');
    expect(copy).not.toMatch(/\b(ai|a\.i\.|artificial intelligence|gpt|chatbot|robot)\b/);
  });
});
