import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { createPersistence } from './persist';

function memory(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const LEGACY_CONFIG = '{"type":"brown","volume":70,"pan":-20}';

describe('persistence', () => {
  it('migrates the legacy config once', () => {
    const m = memory({ 'noise-app-config': LEGACY_CONFIG });
    const p = createPersistence(m);
    const s = p.loadSettings();
    expect([s.type, s.volume, s.pan]).toEqual(['brown', 70, -20]);
    expect(m.data.has('noisehue:settings')).toBe(true);
    expect(m.data.get('noise-app-config')).toBe(LEGACY_CONFIG);
    m.data.set('noise-app-config', '{"type":"blue","volume":10}');
    expect(p.loadSettings().type).toBe('brown');
    expect(p.loadSettings().volume).toBe(70);
  });

  it('round-trips and sanitizes stored values', () => {
    const m = memory();
    const p = createPersistence(m);
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
    p.saveSettings({ ...DEFAULT_SETTINGS, type: 'violet', volume: 12 });
    expect(p.loadSettings().type).toBe('violet');
    m.data.set('noisehue:settings', '{not json');
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores old ui/preset keys and tolerates throwing storage', () => {
    const m = memory({ 'noisehue:ui': '{not json', 'noisehue:presets': 'junk' });
    expect(createPersistence(m).loadSettings()).toEqual(DEFAULT_SETTINGS);
    const boom = () => {
      throw new Error('denied');
    };
    for (const storage of [{ getItem: boom, setItem: boom }, null]) {
      const p = createPersistence(storage);
      expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => p.saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    }
  });
});
