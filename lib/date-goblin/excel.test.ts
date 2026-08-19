import { describe, expect, it } from 'vitest';
import { parseExcel } from './excel';

/** The wall date `Y-M-D` of a successful 1900/1904 parse. */
function ymd(raw: string, system: '1900' | '1904' = '1900'): string | null {
  const r = parseExcel(raw, system);
  if (r.status !== 'local') return null;
  const w = r.wall;
  return `${w.year}-${String(w.month).padStart(2, '0')}-${String(w.day).padStart(2, '0')}`;
}

describe('parseExcel — 1900 system around the phantom leap day', () => {
  it('serial 1 is 1900-01-01', () => {
    expect(ymd('1')).toBe('1900-01-01');
  });

  it('serial 59 is 1900-02-28 (before the phantom)', () => {
    expect(ymd('59')).toBe('1900-02-28');
  });

  it('serial 60 is the fictitious 1900-02-29 and is reported as unreal', () => {
    const r = parseExcel('60', '1900');
    expect(r.status).toBe('error');
    if (r.status === 'error') {
      expect(r.error.code).toBe('excel-phantom');
      expect(r.error.message).toMatch(/1900-02-29/);
    }
  });

  it('serial 61 is 1900-03-01 (the shift skips the phantom)', () => {
    expect(ymd('61')).toBe('1900-03-01');
  });

  it('serial 25569 is the Unix epoch 1970-01-01', () => {
    expect(ymd('25569')).toBe('1970-01-01');
  });
});

describe('parseExcel — fractional time of day', () => {
  it('serial 1.5 is noon on 1900-01-01', () => {
    const r = parseExcel('1.5', '1900');
    expect(r.status).toBe('local');
    if (r.status === 'local') {
      expect(r.wall.hour).toBe(12);
      expect(r.wall.minute).toBe(0);
    }
  });

  it('serial 61.25 is 06:00 on 1900-03-01', () => {
    const r = parseExcel('61.25', '1900');
    if (r.status === 'local') {
      expect(r.wall.day).toBe(1);
      expect(r.wall.month).toBe(3);
      expect(r.wall.hour).toBe(6);
    }
  });
});

describe('parseExcel — unsupported serials', () => {
  it('serial 0 is Excel’s placeholder, not a real day', () => {
    const r = parseExcel('0', '1900');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('excel-zero');
  });

  it('rejects negative serials', () => {
    const r = parseExcel('-5', '1900');
    expect(r.status).toBe('error');
    if (r.status === 'error') expect(r.error.code).toBe('excel-negative');
  });

  it('rejects non-numeric input', () => {
    expect(parseExcel('abc', '1900').status).toBe('error');
  });
});

describe('parseExcel — 1904 system', () => {
  it('serial 0 is 1904-01-01 (no phantom)', () => {
    expect(ymd('0', '1904')).toBe('1904-01-01');
  });

  it('serial 1 is 1904-01-02', () => {
    expect(ymd('1', '1904')).toBe('1904-01-02');
  });

  it('there is no phantom at serial 60', () => {
    // 60 days after 1904-01-01 = 1904-03-01 (1904 is a real leap year).
    expect(ymd('60', '1904')).toBe('1904-03-01');
  });

  it('records the system used', () => {
    const r = parseExcel('1000', '1904');
    if (r.status === 'local') expect(r.recognition.excelSystem).toBe('1904');
  });
});

describe('parseExcel — regression (adversarial review)', () => {
  it('rejects serials beyond Excel’s maximum (9999-12-31)', () => {
    expect(parseExcel('2958466', '1900').status).toBe('error');
    const max = parseExcel('2958465', '1900');
    expect(max.status).toBe('local');
    if (max.status === 'local') {
      expect(max.wall.year).toBe(9999);
      expect(max.wall.month).toBe(12);
      expect(max.wall.day).toBe(31);
    }
  });

  it('never lets a fractional time-of-day carry into the next day', () => {
    // 59.999… must stay on 1900-02-28, not round up across the phantom to 03-01.
    const r = parseExcel('59.999999999999999', '1900');
    expect(r.status).toBe('local');
    if (r.status === 'local') {
      expect(r.wall.month).toBe(2);
      expect(r.wall.day).toBe(28);
    }
  });
});
