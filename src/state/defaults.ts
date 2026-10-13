import { CONFIG } from '../config';
import type { Settings, SoundOptions, UiPrefs } from '../types';

export const OPTION_DEFAULTS: SoundOptions = {
  tilt: 0,
  lowCut: 20,
  highCut: 20000,
  width: 0,
  pan: 0,
  waveDepth: 0,
  wavePeriod: 8,
  brownCorner: 150,
  greenCenter: 500,
  greenWidth: 2,
  greyStrength: 100,
  orangeQ: 30,
  orangeTune: 440,
};

export const OPTION_LIMITS: Record<keyof SoundOptions, [number, number]> = {
  tilt: [-12, 12],
  lowCut: [20, 300],
  highCut: [2000, 20000],
  width: [0, 100],
  pan: [-100, 100],
  waveDepth: [0, 100],
  wavePeriod: [4, 20],
  brownCorner: [20, 300],
  greenCenter: [200, 2000],
  greenWidth: [1, 3],
  greyStrength: [0, 100],
  orangeQ: [5, 60],
  orangeTune: [415, 466],
};

export const VOLUME_LIMITS: [number, number] = [0, 100];
export const SLEEP_MINUTES_LIMITS: [number, number] = [1, 480];

export const DEFAULT_SETTINGS: Settings = {
  ...OPTION_DEFAULTS,
  type: CONFIG.startType,
  volume: CONFIG.defaultVolume,
  muted: false,
};

export const DEFAULT_UI: UiPrefs = {
  pinLeft: true,
  pinRight: true,
  foldLeft: false,
  foldRight: false,
  sleepMinutes: 30,
};

export const MAX_PRESETS = 20;
export const MAX_PRESET_NAME = 32;
