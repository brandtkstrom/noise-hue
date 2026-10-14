import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import {
  brownCorner,
  brownCornerText,
  changeSummary,
  effectiveVolume,
  greenCenter,
  greenCenterText,
  greenWidth,
  greenWidthText,
  greyStrengthText,
  highCut,
  highCutText,
  lowCut,
  lowCutText,
  orangeQText,
  orangeTuneText,
  panText,
  statusColor,
  statusText,
  tiltText,
  volumeGain,
  volumeShort,
  volumeText,
  waveDepthText,
  wavePeriodText,
  widthText,
} from './mappings';

const pink = { ...DEFAULT_SETTINGS, type: 'pink' as const };

describe('volumeGain', () => {
  it('maps endpoints and the dB curve', () => {
    expect(volumeGain(100, false)).toBe(1);
    expect(volumeGain(50, false)).toBeCloseTo(0.1, 9);
    expect(volumeGain(0, false)).toBe(0);
    expect(volumeGain(80, true)).toBe(0);
  });
  it('is strictly increasing over 1..100', () => {
    for (let v = 2; v <= 100; v++)
      expect(volumeGain(v, false)).toBeGreaterThan(volumeGain(v - 1, false));
  });
  it('effectiveVolume is 0 when muted', () => {
    expect(effectiveVolume({ ...pink, volume: 70, muted: true })).toBe(0);
    expect(effectiveVolume({ ...pink, volume: 70 })).toBe(70);
  });
});

describe('scales', () => {
  it('round-trips and hits endpoints', () => {
    expect(Math.abs(lowCut.fromPos(lowCut.toPos(150)) - 150)).toBeLessThanOrEqual(3);
    expect(highCut.toPos(20000)).toBe(100);
    expect(lowCut.toPos(20)).toBe(0);
    expect(lowCut.fromPos(100)).toBe(300);
    expect(brownCorner.toPos(300)).toBe(100);
    expect(brownCorner.fromPos(0)).toBe(20);
    expect(greenCenter.toPos(2000)).toBe(100);
    expect(greenCenter.fromPos(0)).toBe(200);
    expect(highCut.fromPos(0)).toBe(2000);
    expect(greenWidth.toPos(2)).toBe(20);
    expect(greenWidth.fromPos(25)).toBe(2.5);
  });
});

describe('value text', () => {
  it('matches prototype strings', () => {
    expect(panText(0)).toBe('Center');
    expect(panText(-20)).toBe('L 20');
    expect(panText(35)).toBe('R 35');
    expect(widthText(0)).toBe('Mono');
    expect(widthText(100)).toBe('Full');
    expect(widthText(40)).toBe('40%');
    expect(tiltText(0)).toBe('Neutral');
    expect(tiltText(-3)).toBe('3 dB warmer');
    expect(tiltText(4)).toBe('+4 dB brighter');
    expect(lowCutText(20)).toBe('Off');
    expect(lowCutText(120)).toBe('120 Hz');
    expect(highCutText(19950)).toBe('Off');
    expect(highCutText(8000)).toBe('8.0 kHz');
    expect(waveDepthText(0)).toBe('Off');
    expect(waveDepthText(30)).toBe('30%');
    expect(wavePeriodText(8)).toBe('8 s per wave');
    expect(brownCornerText(150)).toBe('levels off at 150 Hz');
    expect(greenCenterText(500)).toBe('500 Hz');
    expect(greenWidthText(2)).toBe('±2.0 octaves');
    expect(greyStrengthText(0)).toBe('Off (white)');
    expect(greyStrengthText(100)).toBe('100%');
    expect(orangeQText(50)).toBe('Very narrow');
    expect(orangeQText(30)).toBe('Narrow');
    expect(orangeQText(15)).toBe('Medium');
    expect(orangeQText(5)).toBe('Wide');
    expect(orangeTuneText(440)).toBe('A = 440 Hz');
    expect(volumeText({ ...pink, volume: 60 })).toBe('60%');
    expect(volumeText({ ...pink, volume: 60, muted: true })).toBe('Muted (60%)');
    expect(volumeShort({ ...pink, volume: 60 })).toBe('60%');
    expect(volumeShort({ ...pink, muted: true })).toBe('Muted');
  });
});

describe('status', () => {
  it('builds text and colors', () => {
    expect(statusText(true, pink, '27m')).toBe('Playing · Pink · 27m left');
    expect(statusText(true, pink, null)).toBe('Playing · Pink');
    expect(statusText(false, pink, null)).toBe('Paused');
    expect(statusText(false, pink, '27m')).toBe('Paused');
    expect(statusText(true, { ...pink, muted: true }, null)).toBe('Muted · Pink');
    expect(statusColor(false, pink)).toBe('#F2867E');
    expect(statusColor(true, { ...pink, muted: true })).toBe('#EBC66A');
    expect(statusColor(true, pink)).toBe('#74D69A');
  });
});

describe('changes', () => {
  it('counts only the current color keys plus shared options', () => {
    expect(changeSummary(DEFAULT_SETTINGS).count).toBe(0);
    expect(changeSummary({ ...DEFAULT_SETTINGS, type: 'blue', greenCenter: 800 }).count).toBe(0);
    expect(changeSummary({ ...DEFAULT_SETTINGS, type: 'green', greenCenter: 800 }).count).toBe(1);
    expect(changeSummary({ ...DEFAULT_SETTINGS, pan: 10, tilt: 2 }).count).toBe(2);
  });
  it('computes group flags', () => {
    expect(changeSummary(DEFAULT_SETTINGS)).toEqual({
      char: false,
      tone: false,
      space: false,
      waves: false,
      count: 0,
    });
    expect(changeSummary({ ...DEFAULT_SETTINGS, type: 'green', greenWidth: 1 }).char).toBe(true);
    expect(changeSummary({ ...DEFAULT_SETTINGS, type: 'blue', greenWidth: 1 }).char).toBe(false);
    expect(changeSummary({ ...DEFAULT_SETTINGS, highCut: 8000 }).tone).toBe(true);
    expect(changeSummary({ ...DEFAULT_SETTINGS, pan: -5 }).space).toBe(true);
    expect(changeSummary({ ...DEFAULT_SETTINGS, wavePeriod: 10 }).waves).toBe(true);
  });
  it('treats values that display as Off as unchanged in both flag and count', () => {
    const off = changeSummary({ ...DEFAULT_SETTINGS, lowCut: 21, highCut: 19900 });
    expect(off.tone).toBe(false);
    expect(off.count).toBe(0);
    expect(changeSummary({ ...DEFAULT_SETTINGS, lowCut: 22 }).count).toBe(1);
    expect(changeSummary({ ...DEFAULT_SETTINGS, highCut: 19899 }).count).toBe(1);
  });
});
