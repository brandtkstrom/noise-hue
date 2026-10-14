export type NoiseId = 'white' | 'grey' | 'brown' | 'pink' | 'green' | 'blue' | 'violet' | 'orange';

export interface SoundOptions {
  tilt: number;
  lowCut: number;
  highCut: number;
  width: number;
  pan: number;
  waveDepth: number;
  wavePeriod: number;
  brownCorner: number;
  greenCenter: number;
  greenWidth: number;
  greyStrength: number;
  orangeQ: number;
  orangeTune: number;
}

export interface Settings extends SoundOptions {
  type: NoiseId;
  volume: number;
  muted: boolean;
}

export type ColorOptionKey =
  'brownCorner' | 'greenCenter' | 'greenWidth' | 'greyStrength' | 'orangeQ' | 'orangeTune';
