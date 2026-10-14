import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { sanitizeSettings } from './validate';

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
});
