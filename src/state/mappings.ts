import { CONFIG } from '../config';
import { getNoise } from '../noise/catalog';
import type { Settings, SoundOptions } from '../types';
import { OPTION_KEYS } from './defaults';

/** At or below this the low cut displays as "Off". */
const LOW_CUT_OFF = 21;
/** At or above this the high cut displays as "Off". */
const HIGH_CUT_OFF = 19900;

export function optionsOf(s: Settings): SoundOptions {
  const out = {} as SoundOptions;
  for (const k of OPTION_KEYS) out[k] = s[k];
  return out;
}

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

export function statusText(playing: boolean, s: Settings): string {
  if (!playing) return 'Paused';
  return `${effectiveVolume(s) === 0 ? 'Muted' : 'Playing'} · ${getNoise(s.type).name}`;
}

export type StatusState = 'paused' | 'muted' | 'playing';

export function statusState(playing: boolean, s: Settings): StatusState {
  if (!playing) return 'paused';
  return effectiveVolume(s) === 0 ? 'muted' : 'playing';
}
