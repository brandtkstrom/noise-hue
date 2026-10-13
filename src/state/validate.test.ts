import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_UI, MAX_PRESETS, OPTION_DEFAULTS } from './defaults';
import { sanitizePresets, sanitizeSettings, sanitizeUi } from './validate';

const validPreset = (i = 0) => ({
  id: `p${i}`,
  name: `Preset ${i}`,
  type: 'brown',
  options: { ...OPTION_DEFAULTS, tilt: 3 },
});

describe('validate', () => {
  it('sanitizes junk fields individually', () => {
    const s = sanitizeSettings({ type: 'pink', volume: 999, tilt: 'x', lowCut: 100, muted: 'yes' });
    expect(s.type).toBe('pink');
    expect(s.volume).toBe(50);
    expect(s.tilt).toBe(0);
    expect(s.lowCut).toBe(100);
    expect(s.muted).toBe(false);
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(sanitizeSettings({ type: 'teal' }).type).toBe('white');
  });

  it('rejects NaN, Infinity and out-of-range numbers, keeps fractions', () => {
    expect(sanitizeSettings({ volume: NaN }).volume).toBe(50);
    expect(sanitizeSettings({ volume: Infinity }).volume).toBe(50);
    expect(sanitizeSettings({ tilt: -13 }).tilt).toBe(0);
    expect(sanitizeSettings({ greenWidth: 1.5 }).greenWidth).toBe(1.5);
  });

  it('sanitizes ui prefs', () => {
    expect(sanitizeUi(undefined)).toEqual(DEFAULT_UI);
    const u = sanitizeUi({ pinLeft: false, foldLeft: 1, sleepMinutes: 9999 });
    expect(u.pinLeft).toBe(false);
    expect(u.foldLeft).toBe(false);
    expect(u.sleepMinutes).toBe(30);
    expect(sanitizeUi({ sleepMinutes: 45 }).sleepMinutes).toBe(45);
  });

  it('drops malformed presets individually', () => {
    const noName = { ...validPreset(1), name: undefined };
    const out = sanitizePresets([validPreset(0), noName]);
    expect(out).toHaveLength(1);
    expect(out[0]?.id).toBe('p0');
    expect(sanitizePresets('nope')).toEqual([]);
    expect(sanitizePresets([{ ...validPreset(2), type: 'teal' }])).toEqual([]);
  });

  it('sanitizes preset options per field', () => {
    const out = sanitizePresets([{ ...validPreset(0), options: { tilt: 5, lowCut: 'x' } }]);
    expect(out[0]?.options.tilt).toBe(5);
    expect(out[0]?.options.lowCut).toBe(20);
  });

  it('keeps at most 20 presets', () => {
    const many = Array.from({ length: 25 }, (_, i) => validPreset(i));
    expect(sanitizePresets(many)).toHaveLength(MAX_PRESETS);
  });
});
