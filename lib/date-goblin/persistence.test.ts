import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  deserializeSettings,
  MAX_COMPARISON_ZONES,
  serializeSettings,
  STORAGE_VERSION,
  type Settings,
} from './persistence';

const defaults = defaultSettings('UTC');

describe('settings persistence — round trip', () => {
  it('serializes and deserializes valid settings', () => {
    const settings: Settings = {
      mode: 'unix',
      zone: 'America/New_York',
      comparisonZones: ['Asia/Tokyo', 'Europe/Paris'],
      excelSystem: '1904',
      unixUnit: 'milliseconds',
    };
    const back = deserializeSettings(serializeSettings(settings), defaults);
    expect(back).toEqual(settings);
  });
});

describe('settings persistence — resilience', () => {
  it('returns null for malformed JSON', () => {
    expect(deserializeSettings('{not json', defaults)).toBeNull();
  });

  it('returns null for a non-object', () => {
    expect(deserializeSettings('42', defaults)).toBeNull();
  });

  it('rejects an incompatible version', () => {
    const blob = JSON.stringify({ version: STORAGE_VERSION + 1, mode: 'iso', zone: 'UTC' });
    expect(deserializeSettings(blob, defaults)).toBeNull();
  });

  it('falls back to defaults for an invalid mode', () => {
    const blob = JSON.stringify({ version: STORAGE_VERSION, mode: 'telepathy', zone: 'UTC' });
    const back = deserializeSettings(blob, defaults);
    expect(back?.mode).toBe(defaults.mode);
  });

  it('drops an invalid stored zone', () => {
    const blob = JSON.stringify({ version: STORAGE_VERSION, mode: 'auto', zone: 'Not/AZone' });
    expect(deserializeSettings(blob, defaults)?.zone).toBe('UTC');
  });

  it('filters invalid comparison zones and dedupes', () => {
    const blob = JSON.stringify({
      version: STORAGE_VERSION,
      mode: 'auto',
      zone: 'UTC',
      comparisonZones: ['Asia/Tokyo', 'Not/AZone', 'Asia/Tokyo', 42],
    });
    expect(deserializeSettings(blob, defaults)?.comparisonZones).toEqual(['Asia/Tokyo']);
  });

  it('caps comparison zones at the maximum', () => {
    const many = Array.from(
      { length: MAX_COMPARISON_ZONES + 4 },
      (_, i) =>
        [
          'Asia/Tokyo',
          'Europe/Paris',
          'America/Chicago',
          'Australia/Sydney',
          'Africa/Cairo',
          'Asia/Dubai',
          'Pacific/Auckland',
          'Europe/Berlin',
          'Asia/Kolkata',
          'America/Denver',
        ][i],
    );
    const blob = JSON.stringify({
      version: STORAGE_VERSION,
      mode: 'auto',
      zone: 'UTC',
      comparisonZones: many,
    });
    const back = deserializeSettings(blob, defaults);
    expect(back?.comparisonZones.length).toBe(MAX_COMPARISON_ZONES);
  });

  it('returns null for empty/null input', () => {
    expect(deserializeSettings('', defaults)).toBeNull();
    expect(deserializeSettings(null, defaults)).toBeNull();
  });
});
