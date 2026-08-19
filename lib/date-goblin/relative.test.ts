import { describe, expect, it } from 'vitest';
import { parseUnix } from './unix';
import { relativeTime } from './relative';
import type { Instant } from './types';

function instantMs(ms: number): Instant {
  const r = parseUnix(String(ms), 'milliseconds');
  if (r.status !== 'instant') throw new Error('bad');
  return r.instant;
}

const NOW = 1_786_998_240_000; // fixed reference "now"

describe('relativeTime', () => {
  it('says "just now" within a minute', () => {
    const r = relativeTime(instantMs(NOW + 30_000), NOW);
    expect(r.text).toBe('just now');
    expect(r.withinMinute).toBe(true);
  });

  it('reports hours in the past', () => {
    const r = relativeTime(instantMs(NOW - 3 * 3_600_000), NOW);
    expect(r.text).toBe('3 hours ago');
    expect(r.deltaMilliseconds).toBe(-3 * 3_600_000);
  });

  it('reports days in the future', () => {
    expect(relativeTime(instantMs(NOW + 12 * 86_400_000), NOW).text).toBe('in 12 days');
  });

  it('uses natural wording for one day', () => {
    expect(relativeTime(instantMs(NOW - 86_400_000), NOW).text).toBe('yesterday');
    expect(relativeTime(instantMs(NOW + 86_400_000), NOW).text).toBe('tomorrow');
  });

  it('reports years for large gaps', () => {
    expect(relativeTime(instantMs(NOW - 2 * 31_536_000_000), NOW).text).toBe('2 years ago');
  });
});
