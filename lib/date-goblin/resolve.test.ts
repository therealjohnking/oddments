import { describe, expect, it } from 'vitest';
import { wallIso } from './core';
import { resolveWallTime } from './resolve';
import type { WallDateTime } from './types';

/** Build a wall time from components (zones/dates are always explicit here). */
function wall(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second = 0,
  nanosecond = 0,
): WallDateTime {
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    nanosecond,
    iso: wallIso(year, month, day, hour, minute, second, nanosecond),
  };
}

const NY = 'America/New_York';
const LORD_HOWE = 'Australia/Lord_Howe';

describe('resolveWallTime — ordinary times', () => {
  it('resolves a normal summer time uniquely', () => {
    const r = resolveWallTime(wall(2026, 6, 15, 12, 0), NY);
    expect(r.kind).toBe('unique');
    if (r.kind === 'unique') {
      expect(r.reading.instant.iso).toBe('2026-06-15T16:00:00Z');
      expect(r.reading.reading.offset).toBe('-04:00');
    }
  });

  it('resolves a time just after a spring-forward uniquely', () => {
    const r = resolveWallTime(wall(2026, 3, 8, 3, 0), NY);
    expect(r.kind).toBe('unique');
    if (r.kind === 'unique') expect(r.reading.reading.offset).toBe('-04:00');
  });

  it('resolves UTC without any DST', () => {
    const r = resolveWallTime(wall(2026, 11, 1, 1, 30), 'UTC');
    expect(r.kind).toBe('unique');
    if (r.kind === 'unique') expect(r.reading.instant.iso).toBe('2026-11-01T01:30:00Z');
  });
});

describe('resolveWallTime — fall-back fold (ambiguous)', () => {
  it('surfaces both instants for 01:30 on the New York fall-back', () => {
    const r = resolveWallTime(wall(2026, 11, 1, 1, 30), NY);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') {
      expect(r.earlier.reading.offset).toBe('-04:00');
      expect(r.earlier.instant.iso).toBe('2026-11-01T05:30:00Z');
      expect(r.later.reading.offset).toBe('-05:00');
      expect(r.later.instant.iso).toBe('2026-11-01T06:30:00Z');
      expect(r.shiftMinutes).toBe(60);
    }
  });

  it('handles Lord Howe’s 30-minute fold', () => {
    const r = resolveWallTime(wall(2026, 4, 5, 1, 45), LORD_HOWE);
    expect(r.kind).toBe('ambiguous');
    if (r.kind === 'ambiguous') {
      expect(r.shiftMinutes).toBe(30);
      expect(r.earlier.reading.offset).toBe('+11:00');
      expect(r.later.reading.offset).toBe('+10:30');
    }
  });
});

describe('resolveWallTime — spring-forward gap (nonexistent)', () => {
  it('reports 02:30 as skipped in New York with the surrounding readings', () => {
    const r = resolveWallTime(wall(2026, 3, 8, 2, 30), NY);
    expect(r.kind).toBe('gap');
    if (r.kind === 'gap') {
      expect(r.gapMinutes).toBe(60);
      expect(r.gapStartLabel).toBe('02:00');
      expect(r.gapEndLabel).toBe('03:00');
      expect(r.before.reading.offset).toBe('-05:00');
      expect(r.before.instant.iso).toBe('2026-03-08T06:30:00Z');
      expect(r.after.reading.offset).toBe('-04:00');
      expect(r.after.instant.iso).toBe('2026-03-08T07:30:00Z');
    }
  });

  it('handles Lord Howe’s 30-minute gap', () => {
    const r = resolveWallTime(wall(2026, 10, 4, 2, 15), LORD_HOWE);
    expect(r.kind).toBe('gap');
    if (r.kind === 'gap') {
      expect(r.gapMinutes).toBe(30);
      expect(r.gapStartLabel).toBe('02:00');
      expect(r.gapEndLabel).toBe('02:30');
    }
  });
});

describe('resolveWallTime — regression (adversarial review)', () => {
  it('labels the gap correctly when the requested time is the exact gap start', () => {
    // getTimeZoneTransition('previous') is exclusive; at the exact gap start the
    // post-jump reading lands on the transition, so the labels must be derived
    // from the pre-gap reading looking forward.
    const r = resolveWallTime(wall(2026, 3, 8, 2, 0), NY);
    expect(r.kind).toBe('gap');
    if (r.kind === 'gap') {
      expect(r.gapStartLabel).toBe('02:00');
      expect(r.gapEndLabel).toBe('03:00');
    }
  });

  it('labels the exact gap start for a 30-minute (Lord Howe) transition', () => {
    const r = resolveWallTime(wall(2026, 10, 4, 2, 0), LORD_HOWE);
    if (r.kind === 'gap') {
      expect(r.gapStartLabel).toBe('02:00');
      expect(r.gapEndLabel).toBe('02:30');
    }
  });

  it('renders a sub-minute historical LMT offset losslessly', () => {
    // Pre-standardisation New York ran on local mean time, −04:56:02.
    const r = resolveWallTime(wall(1870, 6, 1, 12, 0), NY);
    expect(r.kind).toBe('unique');
    if (r.kind === 'unique') expect(r.reading.reading.offset).toBe('-04:56:02');
  });
});
