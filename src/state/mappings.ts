import { CONFIG } from '../config';
import { ALL_COLOR_OPTION_KEYS, colorKeysFor, getNoise } from '../noise/catalog';
import type { Settings, SoundOptions } from '../types';
import { OPTION_DEFAULTS, OPTION_KEYS } from './defaults';

// Intentional divergence from the prototype: its dots hid "Off" cuts but its "N changed"
// summary counted them. Both derive from these thresholds now, so they cannot disagree.
/** At or below this the low cut displays as "Off" and does not count as a change. */
const LOW_CUT_OFF = 21;
/** At or above this the high cut displays as "Off" and does not count as a change. */
const HIGH_CUT_OFF = 19900;
/** Options owned by some color; only the current color's keys count as changes. */
const ALL_COLOR_KEYS = new Set<keyof SoundOptions>(ALL_COLOR_OPTION_KEYS);

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
export const lowCutText = (hz: number): string =>
  hz <= LOW_CUT_OFF ? 'Off' : `${Math.round(hz)} Hz`;
export const highCutText = (hz: number): string =>
  hz >= HIGH_CUT_OFF ? 'Off' : `${(hz / 1000).toFixed(1)} kHz`;
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

export interface ChangeSummary {
  /** Whether the current color's own options differ from defaults. */
  char: boolean;
  tone: boolean;
  space: boolean;
  waves: boolean;
  /** Changed option fields: the current color's keys plus shared options. */
  count: number;
}

/** Differs from its default. The tone cuts use the same "Off" range as their labels. */
function optionChanged(s: Settings, k: keyof SoundOptions): boolean {
  if (k === 'lowCut') return s.lowCut > LOW_CUT_OFF;
  if (k === 'highCut') return s.highCut < HIGH_CUT_OFF;
  return s[k] !== OPTION_DEFAULTS[k];
}

/**
 * Which sound groups differ from defaults and how many option fields changed.
 * Dots and count share these predicates, so they cannot disagree.
 */
export function changeSummary(s: Settings): ChangeSummary {
  const colorKeys = new Set<keyof SoundOptions>(colorKeysFor(s.type));
  const changed = (k: keyof SoundOptions): boolean =>
    (!ALL_COLOR_KEYS.has(k) || colorKeys.has(k)) && optionChanged(s, k);
  const anyChanged = (keys: readonly (keyof SoundOptions)[]): boolean => keys.some(changed);
  return {
    char: [...colorKeys].some(changed),
    tone: anyChanged(['tilt', 'lowCut', 'highCut']),
    space: anyChanged(['pan', 'width']),
    waves: anyChanged(['waveDepth', 'wavePeriod']),
    count: OPTION_KEYS.filter(changed).length,
  };
}
