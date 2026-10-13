import { CONFIG } from '../config';
import { colorKeysFor, getNoise } from '../noise/catalog';
import type { Settings } from '../types';
import { OPTION_DEFAULTS } from './defaults';

export function volumeGain(volume: number, muted: boolean): number {
  if (muted || volume <= 0) return 0;
  return 10 ** ((CONFIG.volumeFloorDb * (1 - volume / 100)) / 20);
}

export function effectiveVolume(s: Settings): number {
  return s.muted ? 0 : s.volume;
}

export interface LogScale {
  toPos(value: number): number;
  fromPos(pos: number): number;
}

function logScale(base: number, min: number): LogScale {
  return {
    toPos: (value) => Math.round((100 * Math.log(value / min)) / Math.log(base)),
    fromPos: (pos) => Math.round(min * base ** (pos / 100)),
  };
}

export const lowCut = logScale(15, 20);
export const highCut = logScale(10, 2000);
export const brownCorner = logScale(15, 20);
export const greenCenter = logScale(10, 200);
export const greenWidth: LogScale = {
  toPos: (w) => Math.round(w * 10),
  fromPos: (pos) => pos / 10,
};

export const panText = (pan: number): string =>
  pan === 0 ? 'Center' : pan < 0 ? `L ${-pan}` : `R ${pan}`;
export const widthText = (w: number): string => (w === 0 ? 'Mono' : w === 100 ? 'Full' : `${w}%`);
export const tiltText = (t: number): string =>
  t === 0 ? 'Neutral' : t > 0 ? `+${t} dB brighter` : `${-t} dB warmer`;
export const lowCutText = (hz: number): string => (hz <= 21 ? 'Off' : `${Math.round(hz)} Hz`);
export const highCutText = (hz: number): string =>
  hz >= 19900 ? 'Off' : `${(hz / 1000).toFixed(1)} kHz`;
export const waveDepthText = (d: number): string => (d === 0 ? 'Off' : `${d}%`);
export const wavePeriodText = (p: number): string => `${p} s per wave`;
export const brownCornerText = (hz: number): string => `levels off at ${Math.round(hz)} Hz`;
export const greenCenterText = (hz: number): string => `${Math.round(hz)} Hz`;
export const greenWidthText = (w: number): string => `±${w.toFixed(1)} octaves`;
export const greyStrengthText = (g: number): string => (g === 0 ? 'Off (white)' : `${g}%`);
export const orangeQText = (q: number): string =>
  q >= 45 ? 'Very narrow' : q >= 25 ? 'Narrow' : q >= 12 ? 'Medium' : 'Wide';
export const orangeTuneText = (hz: number): string => `A = ${hz} Hz`;
export const volumeText = (s: Settings): string =>
  s.muted ? `Muted (${s.volume}%)` : `${s.volume}%`;
export const volumeShort = (s: Settings): string => (s.muted ? 'Muted' : `${s.volume}%`);

export function statusText(playing: boolean, s: Settings, timerLabel: string | null): string {
  if (!playing) return 'Paused';
  const base = `${effectiveVolume(s) === 0 ? 'Muted' : 'Playing'} · ${getNoise(s.type).name}`;
  return timerLabel !== null ? `${base} · ${timerLabel} left` : base;
}

export function statusColor(playing: boolean, s: Settings): string {
  if (!playing) return '#F2867E';
  return effectiveVolume(s) === 0 ? '#EBC66A' : '#74D69A';
}

export function changeFlags(s: Settings): {
  char: boolean;
  tone: boolean;
  space: boolean;
  waves: boolean;
} {
  return {
    char: colorKeysFor(s.type).some((k) => s[k] !== OPTION_DEFAULTS[k]),
    tone: s.tilt !== OPTION_DEFAULTS.tilt || s.lowCut > 21 || s.highCut < 19900,
    space: s.pan !== OPTION_DEFAULTS.pan || s.width !== OPTION_DEFAULTS.width,
    waves: s.waveDepth !== OPTION_DEFAULTS.waveDepth || s.wavePeriod !== OPTION_DEFAULTS.wavePeriod,
  };
}

export function changedCount(s: Settings): number {
  const colorKeys = new Set<string>(colorKeysFor(s.type));
  const allColorKeys = new Set<string>([
    'brownCorner',
    'greenCenter',
    'greenWidth',
    'greyStrength',
    'orangeQ',
    'orangeTune',
  ]);
  let n = 0;
  for (const k of Object.keys(OPTION_DEFAULTS) as (keyof typeof OPTION_DEFAULTS)[]) {
    if (allColorKeys.has(k) && !colorKeys.has(k)) continue;
    if (s[k] !== OPTION_DEFAULTS[k]) n++;
  }
  return n;
}
