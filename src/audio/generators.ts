// Pure noise generation and biquad filter math (ported from the prototype).
import { colorKeysFor, getNoise, type NoiseInfo } from '../noise/catalog';
import type { NoiseId, SoundOptions } from '../types';

export type BiquadType = 'lowpass' | 'highpass' | 'notch' | 'peaking' | 'lowshelf' | 'highshelf';
/** [type, f0 (Hz), Q, gain (dB)] */
export type BiquadSpec = [BiquadType, number, number, number];

export interface Coeffs {
  b0: number;
  b1: number;
  b2: number;
  a1: number;
  a2: number;
}

/** Extra biquad stages a color applies on top of its base generator, or null. */
export function filterChain(id: NoiseId, o: SoundOptions): BiquadSpec[] | null {
  if (id === 'grey') {
    const g = o.greyStrength / 100;
    return [
      ['lowshelf', 250, 0.7, 14 * g],
      ['peaking', 3000, 1, -6 * g],
      ['highshelf', 9000, 0.7, 5 * g],
    ];
  }
  if (id === 'green') {
    const spread = Math.pow(2, o.greenWidth);
    return [
      ['highpass', o.greenCenter / spread, 0.707, 0],
      ['lowpass', Math.min(20000, o.greenCenter * spread), 0.707, 0],
      ['peaking', o.greenCenter, 0.7, 4],
    ];
  }
  if (id === 'orange') {
    const out: BiquadSpec[] = [];
    for (let n = -33; n <= 38; n++) {
      out.push(['notch', o.orangeTune * Math.pow(2, n / 12), o.orangeQ, 0]);
    }
    return out;
  }
  return null;
}

/** Cache key covering only the options that change this color's sound. */
export function colorSignature(id: NoiseId, o: SoundOptions): string {
  return (
    id +
    '|' +
    colorKeysFor(id)
      .map((k) => o[k])
      .join(',')
  );
}

/** RBJ cookbook coefficients, normalized by a0. */
export function biquad(spec: BiquadSpec, sr: number): Coeffs {
  const [type, f0, Q, gainDb] = spec;
  const A = Math.pow(10, gainDb / 40);
  const w = (2 * Math.PI * f0) / sr;
  const cw = Math.cos(w);
  const sw = Math.sin(w);
  const al = sw / (2 * Q);
  const sA = 2 * Math.sqrt(A) * al;
  let b0: number, b1: number, b2: number, a0: number, a1: number, a2: number;
  if (type === 'lowpass') {
    b0 = (1 - cw) / 2;
    b1 = 1 - cw;
    b2 = b0;
    a0 = 1 + al;
    a1 = -2 * cw;
    a2 = 1 - al;
  } else if (type === 'highpass') {
    b0 = (1 + cw) / 2;
    b1 = -(1 + cw);
    b2 = b0;
    a0 = 1 + al;
    a1 = -2 * cw;
    a2 = 1 - al;
  } else if (type === 'notch') {
    b0 = 1;
    b1 = -2 * cw;
    b2 = 1;
    a0 = 1 + al;
    a1 = -2 * cw;
    a2 = 1 - al;
  } else if (type === 'peaking') {
    b0 = 1 + al * A;
    b1 = -2 * cw;
    b2 = 1 - al * A;
    a0 = 1 + al / A;
    a1 = -2 * cw;
    a2 = 1 - al / A;
  } else if (type === 'lowshelf') {
    b0 = A * (A + 1 - (A - 1) * cw + sA);
    b1 = 2 * A * (A - 1 - (A + 1) * cw);
    b2 = A * (A + 1 - (A - 1) * cw - sA);
    a0 = A + 1 + (A - 1) * cw + sA;
    a1 = -2 * (A - 1 + (A + 1) * cw);
    a2 = A + 1 + (A - 1) * cw - sA;
  } else {
    b0 = A * (A + 1 + (A - 1) * cw + sA);
    b1 = -2 * A * (A - 1 + (A + 1) * cw);
    b2 = A * (A + 1 + (A - 1) * cw - sA);
    a0 = A + 1 - (A - 1) * cw + sA;
    a1 = 2 * (A - 1 - (A + 1) * cw);
    a2 = A + 1 - (A - 1) * cw - sA;
  }
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}

/** Filters `x` in place (direct form I, zero initial state). */
export function applyBiquad(c: Coeffs, x: Float32Array): void {
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const x0 = x[i]!;
    const y0 = c.b0 * x0 + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    x[i] = y0;
  }
}

/** Magnitude response of `c` at `f` Hz, in dB. */
export function biquadMagDb(c: Coeffs, f: number, sr: number): number {
  const w = (2 * Math.PI * f) / sr;
  const nr = c.b0 + c.b1 * Math.cos(w) + c.b2 * Math.cos(2 * w);
  const ni = -c.b1 * Math.sin(w) - c.b2 * Math.sin(2 * w);
  const dr = 1 + c.a1 * Math.cos(w) + c.a2 * Math.cos(2 * w);
  const di = -c.a1 * Math.sin(w) - c.a2 * Math.sin(2 * w);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

/** Idealized response curve (dB, 0 at 1 kHz for tilted colors) used for drawing. */
export function idealDb(info: NoiseInfo, f: number, o: SoundOptions): number {
  if (info.id === 'brown') {
    return (
      -10 * Math.log10(1 + Math.pow(f / o.brownCorner, 2)) +
      10 * Math.log10(1 + Math.pow(1000 / o.brownCorner, 2))
    );
  }
  let db = info.tilt * Math.log2(f / 1000);
  const chain = info.id === 'orange' ? null : filterChain(info.id, o);
  if (chain) for (const spec of chain) db += biquadMagDb(biquad(spec, 48000), f, 48000);
  return db;
}

/**
 * One channel of loopable noise: generated with a 50 ms tail, filtered,
 * DC-removed, normalized to 0.2 RMS, the tail crossfaded into the head,
 * and clipped to ±1.
 */
export function makeNoiseChannel(
  sr: number,
  len: number,
  id: NoiseId,
  o: SoundOptions,
  rand: () => number = Math.random,
): Float32Array {
  const brownR = Math.exp((-2 * Math.PI * o.brownCorner) / sr);
  const fade = Math.floor(sr * 0.05);
  const raw = new Float32Array(len + fade);
  const info = getNoise(id);
  const type = info.base ?? id;
  let b0 = 0,
    b1 = 0,
    b2 = 0,
    b3 = 0,
    b4 = 0,
    b5 = 0,
    b6 = 0,
    last = 0,
    prev = 0,
    prevP = 0;
  for (let i = 0; i < raw.length; i++) {
    const w = rand() * 2 - 1;
    let v: number;
    if (type === 'white') v = w;
    else if (type === 'violet') {
      v = w - prev;
      prev = w;
    } else if (type === 'brown') {
      last = brownR * last + (1 - brownR) * w;
      v = last;
    } else {
      // Paul Kellet's refined pink filter
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      const p = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
      b6 = w * 0.115926;
      if (type === 'blue') {
        v = p - prevP;
        prevP = p;
      } else v = p;
    }
    raw[i] = v;
  }
  const chain = filterChain(id, o);
  if (chain) for (const spec of chain) applyBiquad(biquad(spec, sr), raw);
  let mean = 0;
  for (let k = 0; k < raw.length; k++) mean += raw[k]!;
  mean /= raw.length;
  let sum = 0;
  for (let k = 0; k < raw.length; k++) {
    const c = raw[k]! - mean;
    raw[k] = c;
    sum += c * c;
  }
  const scale = 0.2 / Math.sqrt(sum / raw.length);
  const d = new Float32Array(len);
  for (let k = 0; k < len; k++) {
    let s = raw[k]!;
    if (k < fade) {
      const t = k / fade;
      s = raw[k]! * t + raw[len + k]! * (1 - t);
    }
    s *= scale;
    d[k] = s > 1 ? 1 : s < -1 ? -1 : s;
  }
  return d;
}
