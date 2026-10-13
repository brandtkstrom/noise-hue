import { describe, expect, it } from 'vitest';
import { getNoise } from '../noise/catalog';
import { OPTION_DEFAULTS } from '../state/defaults';
import { BANDS, dbToY, freqToX, idealArea, idealPath, measuredPaths, wavePath } from './waveform';

const ys = (d: string) => [...d.matchAll(/[ML]\s*[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1]));

describe('waveform', () => {
  it('flat line when no samples', () => {
    expect(wavePath(null)).toBe('M0 80 L600 80');
  });
  it('clamps sample amplitude', () => {
    expect(Math.min(...ys(wavePath([1])))).toBeGreaterThanOrEqual(6);
    expect(Math.max(...ys(wavePath([-1, 5])))).toBeLessThanOrEqual(154);
  });
  it('maps frequency and dB', () => {
    expect(freqToX(20)).toBe(0);
    expect(freqToX(20000)).toBeCloseTo(600, 9);
    expect(dbToY(0)).toBe(80);
    expect(dbToY(100)).toBe(8);
    expect(dbToY(-100)).toBe(152);
  });
  it('has 28 bands', () => {
    expect(BANDS).toHaveLength(28);
    expect(BANDS[0]?.lo).toBeCloseTo(40, 6);
    expect(BANDS[27]?.hi).toBeCloseTo(16000);
  });
  it('white ideal path is flat', () => {
    const d = idealPath(getNoise('white'), OPTION_DEFAULTS);
    expect(new Set(ys(d))).toEqual(new Set([80]));
    expect(idealArea(getNoise('white'), OPTION_DEFAULTS)).toMatch(/^M0 80 .* L600 80 Z$/);
  });
  it('measured paths', () => {
    const { line, area } = measuredPaths(
      BANDS.map(() => -20),
      getNoise('white'),
      OPTION_DEFAULTS,
    );
    expect(line.startsWith('M')).toBe(true);
    expect(area.endsWith('Z')).toBe(true);
    expect(new Set(ys(line)).size).toBe(1);
  });
});
