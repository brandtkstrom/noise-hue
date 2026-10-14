import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_UI } from './defaults';
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
const LEGACY_PANES = '{"left":false,"right":true,"foldLeft":true}';

describe('persistence', () => {
  it('migrates legacy keys once', () => {
    const m = memory({ 'noise-app-config': LEGACY_CONFIG, 'noise-app-panes': LEGACY_PANES });
    const p = createPersistence(m);
    const s = p.loadSettings();
    expect([s.type, s.volume, s.pan]).toEqual(['brown', 70, -20]);
    const u = p.loadUi();
    expect(u.pinLeft).toBe(false);
    expect(u.foldLeft).toBe(true);
    expect(m.data.has('noisehue:settings')).toBe(true);
    expect(m.data.has('noisehue:ui')).toBe(true);
    expect(m.data.get('noise-app-config')).toBe(LEGACY_CONFIG);
    expect(m.data.get('noise-app-panes')).toBe(LEGACY_PANES);
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
    p.saveUi({ ...DEFAULT_UI, foldRight: true });
    expect(p.loadUi().foldRight).toBe(true);
    p.savePresets([]);
    expect(p.loadPresets()).toEqual([]);
    m.data.set('noisehue:settings', '{not json');
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('throwing storage is tolerated', () => {
    const boom = () => {
      throw new Error('denied');
    };
    for (const storage of [{ getItem: boom, setItem: boom }, null]) {
      const p = createPersistence(storage);
      expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(p.loadUi()).toEqual(DEFAULT_UI);
      expect(p.loadPresets()).toEqual([]);
      expect(() => {
        p.saveSettings(DEFAULT_SETTINGS);
        p.saveUi(DEFAULT_UI);
        p.savePresets([]);
      }).not.toThrow();
    }
  });
});
