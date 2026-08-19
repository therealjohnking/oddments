import { describe, expect, it } from 'vitest';
import { parseUnix } from './unix';

/** Convenience: the ISO of a successful parse. */
function iso(raw: string, unit: Parameters<typeof parseUnix>[1] = 'auto'): string | null {
  const r = parseUnix(raw, unit);
  return r.status === 'instant' ? r.instant.iso : null;
}

describe('parseUnix — epoch & basic', () => {
  it('interprets 0 as the epoch (seconds)', () => {
    expect(iso('0')).toBe('1970-01-01T00:00:00Z');
  });

  it('interprets a 10-digit value as seconds', () => {
    expect(iso('1786998240')).toBe('2026-08-17T20:24:00Z');
  });

  it('interprets a 13-digit value as milliseconds', () => {
    expect(iso('1786998240000')).toBe('2026-08-17T20:24:00Z');
  });

  it('handles a negative (pre-epoch) timestamp', () => {
    const r = parseUnix('-1000000000', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') expect(r.instant.iso).toBe('1938-04-24T22:13:20Z');
  });
});

describe('parseUnix — explicit units', () => {
  it('honours explicit seconds', () => {
    expect(iso('1000000000', 'seconds')).toBe('2001-09-09T01:46:40Z');
  });
  it('honours explicit milliseconds', () => {
    expect(iso('1000000000', 'milliseconds')).toBe('1970-01-12T13:46:40Z');
  });
  it('honours explicit microseconds', () => {
    expect(iso('1000000000', 'microseconds')).toBe('1970-01-01T00:16:40Z');
  });
  it('honours explicit nanoseconds', () => {
    expect(iso('1000000000', 'nanoseconds')).toBe('1970-01-01T00:00:01Z');
  });
});

describe('parseUnix — fractional & precision', () => {
  it('keeps fractional seconds exactly', () => {
    const r = parseUnix('1786998240.123456789', 'seconds');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.instant.epochNanoseconds).toBe(1786998240123456789n);
      expect(r.instant.hasSubsecond).toBe(true);
    }
  });

  it('does not invent precision for a whole-second value', () => {
    const r = parseUnix('1786998240', 'seconds');
    expect(r.status === 'instant' && r.instant.hasSubsecond).toBe(false);
  });

  it('interprets fractional milliseconds', () => {
    const r = parseUnix('1000.5', 'milliseconds');
    expect(r.status === 'instant' && r.instant.epochNanoseconds).toBe(1000500000n);
  });
});

describe('parseUnix — unit ambiguity', () => {
  it('flags an 11-digit value as ambiguous', () => {
    const r = parseUnix('12345678900', 'auto');
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') expect(r.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('names the seconds alternative when auto-picking milliseconds', () => {
    const r = parseUnix('1786998240000', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.recognition.unixUnit).toBe('milliseconds');
      expect(r.recognition.assumption).toMatch(/seconds/);
    }
  });

  it('names the milliseconds alternative when auto-picking seconds', () => {
    const r = parseUnix('1786998240', 'auto');
    if (r.status === 'instant') expect(r.recognition.assumption).toMatch(/milliseconds/);
  });
});

describe('parseUnix — range', () => {
  it('errors when a value is out of range for the chosen unit', () => {
    // 10^19 seconds is far beyond the supported ±10⁸-day window.
    const r = parseUnix('10000000000000000000', 'seconds');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('out-of-range');
  });

  it('rejects non-numeric input', () => {
    const r = parseUnix('12ab', 'auto');
    expect(r.status).toBe('error');
  });

  it('accepts the maximum supported millisecond value', () => {
    const r = parseUnix('8640000000000000', 'milliseconds');
    expect(r.status).toBe('instant');
  });

  it('rejects one millisecond past the maximum', () => {
    const r = parseUnix('8640000000000001', 'milliseconds');
    expect(r.status).toBe('error');
  });
});

describe('parseUnix — regression (adversarial review)', () => {
  it('does not falsely claim "out of range" for an in-range-but-implausible unit', () => {
    const r = parseUnix('9500000000000000', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.recognition.unixUnit).toBe('nanoseconds');
      expect(r.recognition.assumption).toMatch(/implausible date \(year 2271\)/);
      expect(r.recognition.assumption).not.toMatch(/outside the supported range/);
    }
  });
});
