import { describe, expect, it } from 'vitest';
import { formatBytes, formatNumber, formatPercent } from './format';

describe('formatNumber', () => {
  it('groups integers with thousands separators', () => {
    expect(formatNumber(1234567)).toBe('1,234,567');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(-42)).toBe('-42');
  });

  it('strips floating-point presentation noise', () => {
    expect(formatNumber(12.100000000000001)).toBe('12.1');
    expect(formatNumber(0.1 + 0.2)).toBe('0.3');
  });

  it('groups the integer part of a fractional number', () => {
    expect(formatNumber(1234.5)).toBe('1,234.5');
    expect(formatNumber(-1234.25)).toBe('-1,234.25');
  });
});

describe('formatPercent', () => {
  it('renders at most one decimal place', () => {
    expect(formatPercent(0.9375)).toBe('93.8%');
    expect(formatPercent(1)).toBe('100%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(0.5)).toBe('50%');
  });
});

describe('formatBytes', () => {
  it('renders human-readable sizes', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1048576)).toBe('1.0 MB');
  });
});
