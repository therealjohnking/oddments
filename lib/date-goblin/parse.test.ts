import { describe, expect, it } from 'vitest';
import { parseInput } from './parse';

describe('parseInput — ISO instants', () => {
  it('parses UTC Z as an instant', () => {
    const r = parseInput('2026-08-17T20:24:00Z', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.instant.iso).toBe('2026-08-17T20:24:00Z');
      expect(r.recognition.sourceOffset).toBe('Z (UTC)');
    }
  });

  it('parses a negative offset as an instant and converts to UTC', () => {
    const r = parseInput('2026-08-17T16:24:00-04:00', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.instant.iso).toBe('2026-08-17T20:24:00Z');
      expect(r.recognition.sourceOffset).toBe('-04:00');
    }
  });

  it('parses a positive offset as an instant', () => {
    const r = parseInput('2026-08-17T22:24:00+02:00', 'auto');
    expect(r.status === 'instant' && r.instant.iso).toBe('2026-08-17T20:24:00Z');
  });

  it('parses a half-hour offset', () => {
    const r = parseInput('2026-08-18T01:54:00+05:30', 'iso');
    expect(r.status === 'instant' && r.instant.iso).toBe('2026-08-17T20:24:00Z');
  });

  it('parses a 45-minute offset', () => {
    const r = parseInput('2026-08-17T16:24:00+05:45', 'iso');
    expect(r.status === 'instant' && r.instant.iso).toBe('2026-08-17T10:39:00Z');
  });

  it('preserves fractional seconds to nanoseconds', () => {
    const r = parseInput('2026-08-17T20:24:00.123456789Z', 'iso');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') {
      expect(r.instant.hasSubsecond).toBe(true);
      expect(r.instant.epochNanoseconds).toBe(1786998240123456789n);
    }
  });

  it('accepts a comma as the fractional separator', () => {
    const r = parseInput('2026-08-17T20:24:00,5Z', 'iso');
    expect(r.status === 'instant' && r.instant.epochMilliseconds).toBe(1786998240500);
  });
});

describe('parseInput — local wall times', () => {
  it('parses a zoneless datetime as local', () => {
    const r = parseInput('2026-11-01T01:30', 'auto');
    expect(r.status).toBe('local');
    if (r.status === 'local') {
      expect(r.wall.hour).toBe(1);
      expect(r.wall.minute).toBe(30);
      expect(r.recognition.kind).toBe('local');
    }
  });

  it('accepts a space separator', () => {
    const r = parseInput('2026-11-01 01:30', 'auto');
    expect(r.status === 'local' && r.wall.iso).toBe('2026-11-01T01:30:00');
  });

  it('parses a date-only value as local midnight with an assumption', () => {
    const r = parseInput('2026-08-17', 'auto');
    expect(r.status).toBe('local');
    if (r.status === 'local') {
      expect(r.wall.iso).toBe('2026-08-17T00:00:00');
      expect(r.recognition.assumption).toMatch(/00:00:00/);
    }
  });
});

describe('parseInput — invalid ISO', () => {
  it('rejects an impossible calendar date', () => {
    const r = parseInput('2026-02-30', 'iso');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('invalid-date');
  });

  it('rejects an impossible month', () => {
    const r = parseInput('2026-13-01', 'iso');
    expect(r.status).toBe('error');
  });

  it('rejects an invalid time', () => {
    const r = parseInput('2026-08-17T25:00', 'iso');
    expect(r.status).toBe('error');
  });

  it('rejects an offset with no time', () => {
    const r = parseInput('2026-08-17Z', 'iso');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('malformed-iso');
  });

  it('rejects a non-ISO string in ISO mode', () => {
    const r = parseInput('not a date', 'iso');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('malformed-iso');
  });
});

describe('parseInput — auto-detection & ambiguity', () => {
  it('treats a bare 10-digit number as Unix', () => {
    const r = parseInput('1786998240', 'auto');
    expect(r.status === 'instant' && r.recognition.mode).toBe('unix');
  });

  it('refuses to guess an ambiguous slash date', () => {
    const r = parseInput('03/04/26', 'auto');
    expect(r.status).toBe('ambiguous');
    if (r.status === 'ambiguous') {
      // Offers both Month/day and Day/month readings.
      expect(r.candidates.map((c) => c.preview)).toEqual(
        expect.arrayContaining(['2026-03-04', '2026-04-03']),
      );
    }
  });

  it('rejects free text as unsupported', () => {
    const r = parseInput('sometime next week', 'auto');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('unsupported');
  });

  it('returns empty for whitespace', () => {
    expect(parseInput('   ', 'auto').status).toBe('empty');
  });
});

describe('parseInput — Local mode', () => {
  it('rejects a value carrying a zone', () => {
    const r = parseInput('2026-11-01T01:30:00-04:00', 'local');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('local-has-zone');
  });

  it('accepts a zoneless wall time', () => {
    const r = parseInput('2026-03-08 02:30', 'local');
    expect(r.status).toBe('local');
  });
});

describe('parseInput — regression (adversarial review)', () => {
  it('rejects a leap-second :60 rather than silently constraining it to :59', () => {
    const r = parseInput('2026-06-30T23:59:60Z', 'auto');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('leap-second');
  });

  it('accepts lowercase RFC 3339 t/z designators as a clean instant', () => {
    const r = parseInput('2026-08-17t20:24:00z', 'auto');
    expect(r.status).toBe('instant');
    if (r.status === 'instant') expect(r.instant.iso).toBe('2026-08-17T20:24:00Z');
  });
});
