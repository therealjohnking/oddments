import { describe, expect, it } from 'vitest';
import { computeDateStats, computeNumericStats } from './stats';

describe('computeNumericStats', () => {
  it('computes count, min, max, mean, and median', () => {
    const s = computeNumericStats(['10', '20', '30']);
    expect(s).toMatchObject({ count: 3, min: 10, max: 30, mean: 20, median: 20 });
  });

  it('averages the two middle values for an even count', () => {
    expect(computeNumericStats(['1', '2', '3', '4'])!.median).toBe(2.5);
  });

  it('tallies zeros, negatives, and formatted values', () => {
    const s = computeNumericStats(['0', '-5', '5', '$1,000']);
    expect(s).toMatchObject({ zeros: 1, negatives: 1, formatted: 1, count: 4 });
  });

  it('ignores values that are not numeric and returns null when none parse', () => {
    expect(computeNumericStats(['10', 'abc', '20'])!.count).toBe(2);
    expect(computeNumericStats(['abc', 'def'])).toBeNull();
    expect(computeNumericStats([])).toBeNull();
  });
});

describe('computeDateStats', () => {
  it('finds the earliest and latest source values', () => {
    const s = computeDateStats(['2020-06-01', '2019-01-01', '2021-12-31']);
    expect(s).toMatchObject({ earliest: '2019-01-01', latest: '2021-12-31', parsed: 3 });
    expect(s!.parseRate).toBe(1);
  });

  it('reports a parse rate below 1 when some values are not dates', () => {
    const s = computeDateStats(['2020-01-01', 'not a date', '2020-02-01']);
    expect(s!.parsed).toBe(2);
    expect(s!.parseRate).toBeCloseTo(2 / 3, 5);
  });

  it('flags a time component', () => {
    expect(computeDateStats(['2020-01-01'])!.hasTime).toBe(false);
    expect(computeDateStats(['2020-01-01T09:00:00Z'])!.hasTime).toBe(true);
  });
});
