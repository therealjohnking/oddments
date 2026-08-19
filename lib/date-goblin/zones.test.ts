import { describe, expect, it } from 'vitest';
import { parseInput } from './parse';
import { allZones, isValidZone, UTC, zoneOffsetInfo } from './zones';
import type { Instant } from './types';

function instant(isoUtc: string): Instant {
  const r = parseInput(isoUtc, 'iso');
  if (r.status !== 'instant') throw new Error(`not an instant: ${isoUtc}`);
  return r.instant;
}

describe('isValidZone', () => {
  it('accepts UTC and real IANA ids', () => {
    expect(isValidZone(UTC)).toBe(true);
    expect(isValidZone('America/New_York')).toBe(true);
    expect(isValidZone('Asia/Kathmandu')).toBe(true);
  });

  it('rejects nonsense and empty ids', () => {
    expect(isValidZone('Not/AZone')).toBe(false);
    expect(isValidZone('')).toBe(false);
  });
});

describe('allZones', () => {
  it('lists UTC first and includes common zones', () => {
    const zones = allZones();
    expect(zones[0]).toBe('UTC');
    expect(zones).toContain('America/New_York');
    expect(zones.length).toBeGreaterThan(100);
  });

  it('is memoised (stable reference)', () => {
    expect(allZones()).toBe(allZones());
  });
});

describe('zoneOffsetInfo — offsets', () => {
  it('reports UTC as fixed +00:00', () => {
    const info = zoneOffsetInfo(instant('2026-08-17T20:24:00Z'), 'UTC');
    expect(info.offset).toBe('+00:00');
    expect(info.dst).toBe('fixed');
  });

  it('reports India as a fixed +05:30 zone with no DST', () => {
    const info = zoneOffsetInfo(instant('2026-08-17T20:24:00Z'), 'Asia/Kolkata');
    expect(info.offset).toBe('+05:30');
    expect(info.dst).toBe('fixed');
  });

  it('reports Nepal’s +05:45 offset', () => {
    const info = zoneOffsetInfo(instant('2026-08-17T20:24:00Z'), 'Asia/Kathmandu');
    expect(info.offset).toBe('+05:45');
  });
});

describe('zoneOffsetInfo — daylight saving', () => {
  it('flags New York summer as daylight time', () => {
    const info = zoneOffsetInfo(instant('2026-07-15T16:00:00Z'), 'America/New_York');
    expect(info.offset).toBe('-04:00');
    expect(info.dst).toBe('daylight');
    expect(info.dstShiftMinutes).toBe(60);
  });

  it('flags New York winter as standard time', () => {
    const info = zoneOffsetInfo(instant('2026-01-15T17:00:00Z'), 'America/New_York');
    expect(info.offset).toBe('-05:00');
    expect(info.dst).toBe('standard');
  });

  it('flags Sydney (southern hemisphere) January as daylight time', () => {
    const info = zoneOffsetInfo(instant('2026-01-15T02:00:00Z'), 'Australia/Sydney');
    expect(info.offset).toBe('+11:00');
    expect(info.dst).toBe('daylight');
  });
});

describe('zoneOffsetInfo — regression (adversarial review)', () => {
  it('does not report a Ramadan-transition zone as fixed', () => {
    // Morocco drops to +00:00 for Ramadan; the four fixed sample points miss it,
    // so the instant's own offset must be folded into the classification.
    const info = zoneOffsetInfo(instant('2026-03-01T12:00:00Z'), 'Africa/Casablanca');
    expect(info.offset).toBe('+00:00');
    expect(info.dst).not.toBe('fixed');
  });
});
