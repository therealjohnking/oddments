import { describe, expect, it } from 'vitest';
import { epochSecondsDecimal, formatOffset, formatOffsetShort } from './format';

describe('formatOffset', () => {
  it('always shows a sign, including UTC', () => {
    expect(formatOffset(0)).toBe('+00:00');
    expect(formatOffset(-240)).toBe('-04:00');
    expect(formatOffset(330)).toBe('+05:30');
    expect(formatOffset(345)).toBe('+05:45');
    expect(formatOffset(-45)).toBe('-00:45');
    expect(formatOffset(-570)).toBe('-09:30');
  });
});

describe('formatOffsetShort', () => {
  it('renders compact chips', () => {
    expect(formatOffsetShort(0)).toBe('UTC');
    expect(formatOffsetShort(-240)).toBe('-4');
    expect(formatOffsetShort(330)).toBe('+5:30');
    expect(formatOffsetShort(-570)).toBe('-9:30');
  });
});

describe('epochSecondsDecimal', () => {
  it('renders whole seconds with no fraction', () => {
    expect(epochSecondsDecimal(1786998240000000000n)).toBe('1786998240');
    expect(epochSecondsDecimal(0n)).toBe('0');
  });

  it('renders sub-second precision without trailing zeros', () => {
    expect(epochSecondsDecimal(1786998240123456789n)).toBe('1786998240.123456789');
    expect(epochSecondsDecimal(500000000n)).toBe('0.5');
    expect(epochSecondsDecimal(1786998240100000000n)).toBe('1786998240.1');
  });

  it('handles negative sub-second values correctly', () => {
    expect(epochSecondsDecimal(-1n)).toBe('-0.000000001');
    expect(epochSecondsDecimal(-1500000000n)).toBe('-1.5');
  });
});
