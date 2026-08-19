import { describe, expect, it } from 'vitest';
import { interpret } from './interpret';

const NY = 'America/New_York';
const base = { systemZone: 'UTC' as const };

describe('interpret — instant vs local model', () => {
  it('treats an offset timestamp as an instant (resolution null)', () => {
    const r = interpret('2026-08-17T16:24:00-04:00', { ...base, mode: 'auto', zone: NY });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.sourceKind).toBe('instant');
      expect(r.resolution).toBeNull();
      expect(r.instant.iso).toBe('2026-08-17T20:24:00Z');
      expect(r.findings.some((f) => f.id === 'kind-instant')).toBe(true);
    }
  });

  it('treats a zoneless datetime as local, resolved in the zone', () => {
    const r = interpret('2026-06-15T12:00', { ...base, mode: 'auto', zone: NY });
    expect(r.status).toBe('ok');
    if (r.status === 'ok') {
      expect(r.sourceKind).toBe('local');
      expect(r.instant.iso).toBe('2026-06-15T16:00:00Z');
      expect(r.findings.some((f) => f.id === 'kind-local')).toBe(true);
    }
  });
});

describe('interpret — DST selection', () => {
  it('defaults an ambiguous fold to the earlier instant and can switch', () => {
    const earlier = interpret('2026-11-01 01:30', { ...base, mode: 'local', zone: NY });
    expect(earlier.status === 'ok' && earlier.chosen).toBe('earlier');
    expect(earlier.status === 'ok' && earlier.instant.iso).toBe('2026-11-01T05:30:00Z');

    const later = interpret('2026-11-01 01:30', {
      ...base,
      mode: 'local',
      zone: NY,
      foldChoice: 'later',
    });
    expect(later.status === 'ok' && later.instant.iso).toBe('2026-11-01T06:30:00Z');
    expect(later.status === 'ok' && later.findings.some((f) => f.category === 'dst')).toBe(true);
  });

  it('defaults a gap to the after instant and can switch to before', () => {
    const after = interpret('2026-03-08 02:30', { ...base, mode: 'local', zone: NY });
    expect(after.status === 'ok' && after.chosen).toBe('after');
    expect(after.status === 'ok' && after.instant.iso).toBe('2026-03-08T07:30:00Z');

    const before = interpret('2026-03-08 02:30', {
      ...base,
      mode: 'local',
      zone: NY,
      gapChoice: 'before',
    });
    expect(before.status === 'ok' && before.instant.iso).toBe('2026-03-08T06:30:00Z');
  });
});

describe('interpret — zone table', () => {
  it('always includes UTC, the system zone, and the primary zone', () => {
    const r = interpret('2026-08-17T20:24:00Z', {
      systemZone: 'Europe/London',
      mode: 'auto',
      zone: NY,
    });
    if (r.status === 'ok') {
      const ids = r.zones.map((z) => z.reading.zoneId);
      expect(ids).toContain('UTC');
      expect(ids).toContain('Europe/London');
      expect(ids).toContain('America/New_York');
    }
  });

  it('merges roles when zones coincide and dedupes comparisons', () => {
    const r = interpret('2026-08-17T20:24:00Z', {
      systemZone: 'UTC',
      mode: 'auto',
      zone: 'UTC',
      comparisonZones: ['UTC', 'Asia/Tokyo', 'Asia/Tokyo'],
    });
    if (r.status === 'ok') {
      const utc = r.zones.find((z) => z.reading.zoneId === 'UTC');
      expect(utc?.roles).toEqual(expect.arrayContaining(['utc', 'system', 'primary']));
      expect(r.zones.filter((z) => z.reading.zoneId === 'Asia/Tokyo')).toHaveLength(1);
    }
  });
});

describe('interpret — pass-through statuses', () => {
  it('propagates ambiguous input', () => {
    expect(interpret('03/04/26', { ...base, mode: 'auto', zone: 'UTC' }).status).toBe('ambiguous');
  });

  it('propagates the Excel phantom as an error', () => {
    const r = interpret('60', { ...base, mode: 'excel', zone: 'UTC', excelSystem: '1900' });
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('excel-phantom');
  });

  it('is empty for blank input', () => {
    expect(interpret('   ', { ...base, mode: 'auto', zone: 'UTC' }).status).toBe('empty');
  });
});

describe('interpret — relative time', () => {
  it('is omitted without a now, present with one', () => {
    const without = interpret('2026-08-17T20:24:00Z', { ...base, mode: 'auto', zone: 'UTC' });
    expect(without.status === 'ok' && without.relative).toBeNull();

    const withNow = interpret('2026-08-17T20:24:00Z', {
      ...base,
      mode: 'auto',
      zone: 'UTC',
      nowMs: 1786998240000 + 3_600_000,
    });
    expect(withNow.status === 'ok' && withNow.relative?.text).toBe('1 hour ago');
  });
});
