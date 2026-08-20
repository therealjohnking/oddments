import { describe, expect, it } from 'vitest';
import {
  defaultSettings,
  deserializeSettings,
  serializeSettings,
  STORAGE_VERSION,
} from './persistence';

describe('persistence', () => {
  it('defaults to rich + auto', () => {
    expect(defaultSettings()).toEqual({ destination: 'rich', tableLayout: 'auto' });
  });

  it('round-trips valid settings', () => {
    const settings = { destination: 'slack' as const, tableLayout: 'records' as const };
    expect(deserializeSettings(serializeSettings(settings), defaultSettings())).toEqual(settings);
  });

  it('coerces invalid fields to defaults, leniently', () => {
    const raw = JSON.stringify({
      version: STORAGE_VERSION,
      destination: 'nope',
      tableLayout: 'weird',
    });
    expect(deserializeSettings(raw, defaultSettings())).toEqual(defaultSettings());
  });

  it('rejects a version mismatch, corrupt JSON, and empty input', () => {
    expect(deserializeSettings(JSON.stringify({ version: 999 }), defaultSettings())).toBeNull();
    expect(deserializeSettings('{not json', defaultSettings())).toBeNull();
    expect(deserializeSettings('', defaultSettings())).toBeNull();
    expect(deserializeSettings(null, defaultSettings())).toBeNull();
  });

  it('never stores document content — only the two preferences', () => {
    const serialized = serializeSettings({ destination: 'plain', tableLayout: 'aligned' });
    const parsed = JSON.parse(serialized);
    expect(Object.keys(parsed).sort()).toEqual(['destination', 'tableLayout', 'version']);
  });
});
