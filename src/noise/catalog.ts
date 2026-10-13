import type { ColorOptionKey, NoiseId } from '../types';

export interface NoiseInfo {
  id: NoiseId;
  name: string;
  color: string;
  slope: string;
  desc: string;
  tilt: number;
  base?: NoiseId;
}

export const NOISE_TYPES: readonly NoiseInfo[] = [
  {
    id: 'white',
    tilt: 0,
    name: 'White',
    color: '#E8E6E3',
    slope: 'flat · 0 dB/oct',
    desc: 'Equal energy at every frequency. Bright and hissy, like TV static — good for masking voices.',
  },
  {
    id: 'grey',
    tilt: 0,
    base: 'white',
    name: 'Grey',
    color: '#A7AFB9',
    slope: 'flat to the ear',
    desc: 'Tuned to human hearing so every pitch sounds equally loud. Smooth and even — less hissy than white.',
  },
  {
    id: 'brown',
    tilt: -6,
    name: 'Brown',
    color: '#C49468',
    slope: '−6 dB/oct',
    desc: 'Deep and rumbling, almost no hiss. Like a distant waterfall or an airplane cabin.',
  },
  {
    id: 'pink',
    tilt: -3,
    name: 'Pink',
    color: '#F2A7C3',
    slope: '−3 dB/oct',
    desc: 'Softer highs, balanced to the ear. Like steady rain or wind through leaves.',
  },
  {
    id: 'green',
    tilt: -3,
    base: 'pink',
    name: 'Green',
    color: '#8CC79A',
    slope: 'mid band · ~500 Hz',
    desc: 'Centered on the middle frequencies, with softer bass and treble. Like a forest breeze or a gentle stream.',
  },
  {
    id: 'blue',
    tilt: 3,
    name: 'Blue',
    color: '#7FB2F0',
    slope: '+3 dB/oct',
    desc: 'Tilted toward the treble. Crisp and airy, like a fine spray of water.',
  },
  {
    id: 'violet',
    tilt: 6,
    name: 'Violet',
    color: '#B49CF2',
    slope: '+6 dB/oct',
    desc: 'Mostly high frequencies. Sharp and thin — sometimes used to soothe tinnitus.',
  },
  {
    id: 'orange',
    tilt: -3,
    base: 'pink',
    name: 'Orange',
    color: '#F0A35E',
    slope: '−3 dB/oct · note gaps',
    desc: 'Pink noise with narrow gaps at every musical note. Unusual and slightly tonal.',
  },
];

export function getNoise(id: NoiseId): NoiseInfo {
  const found = NOISE_TYPES.find((n) => n.id === id);
  if (!found) throw new Error(`Unknown noise id: ${id}`);
  return found;
}

export const COLOR_OPTION_KEYS: Record<ColorOptionKey, NoiseId> = {
  brownCorner: 'brown',
  greenCenter: 'green',
  greenWidth: 'green',
  greyStrength: 'grey',
  orangeQ: 'orange',
  orangeTune: 'orange',
};

export function colorKeysFor(id: NoiseId): ColorOptionKey[] {
  return (Object.keys(COLOR_OPTION_KEYS) as ColorOptionKey[]).filter(
    (k) => COLOR_OPTION_KEYS[k] === id,
  );
}
