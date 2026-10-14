import { describe, expect, it } from 'vitest';
import { getNoise, NOISE_TYPES } from '../noise/catalog';
import { OPTION_DEFAULTS } from '../state/defaults';
import type { NoiseId } from '../types';
import {
  biquad,
  biquadMagDb,
  colorSignature,
  filterChain,
  idealDb,
  makeNoiseChannel,
} from './generators';
import { bandDb, mulberry32, slopeDbPerOct, welch } from './spectrum.test-util';

const SR = 48000;
const LEN = 2 ** 17;

const cache = new Map<NoiseId, Float32Array>();
function gen(id: NoiseId): Float32Array {
  let x = cache.get(id);
  if (!x) {
    x = makeNoiseChannel(SR, LEN, id, OPTION_DEFAULTS, mulberry32(12345));
    cache.set(id, x);
  }
  return x;
}

describe('spectral slope', () => {
  const cases: [NoiseId, number][] = [
    ['white', 0],
    ['pink', -3],
    ['blue', 3],
    ['violet', 6],
  ];
  it.each(cases)('%s ≈ %d dB/oct over 250 Hz–8 kHz octave bands', (id, expected) => {
    const s = slopeDbPerOct(welch(gen(id), SR), 250, 8000);
    expect(Math.abs(s - expected)).toBeLessThanOrEqual(1);
  });

  it('brown ≈ −6 dB/oct over 1–8 kHz with default corner', () => {
    const s = slopeDbPerOct(welch(gen('brown'), SR), 1000, 8000);
    expect(Math.abs(s + 6)).toBeLessThanOrEqual(1);
  });
});

describe('colored bands', () => {
  // Brief asked for ≥ 6 dB over the 100 Hz band too, but the prototype's
  // green (pink base, HP at 125 Hz, +4 dB peak) is ideally only 2.1 dB
  // lower at 100 Hz than at 500 Hz (idealDb: 4.9 vs 7.0). The steep low side
  // is asserted at 50 Hz instead; 100 Hz only has to sit below the centre.
  it('green energy peaks near its 500 Hz centre', () => {
    const psd = welch(gen('green'), SR);
    const third = (f: number) => bandDb(psd, f / 2 ** (1 / 6), f * 2 ** (1 / 6));
    const mid = third(500);
    expect(mid - third(4000)).toBeGreaterThanOrEqual(6);
    expect(mid - third(50)).toBeGreaterThanOrEqual(6);
    expect(mid - third(100)).toBeGreaterThanOrEqual(1);
    // The measured response is a broad plateau (~150–600 Hz), so the
    // centre band must sit within 2 dB of the loudest band, which itself
    // must lie in the mid band.
    const centres = [
      50, 63, 80, 100, 125, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000, 4000,
      8000,
    ];
    const peak = centres.reduce((a, b) => (third(b) > third(a) ? b : a));
    expect(peak).toBeGreaterThanOrEqual(125);
    expect(peak).toBeLessThanOrEqual(1000);
    expect(third(peak) - mid).toBeLessThanOrEqual(2);
  });

  // Brief's reference band 452–470 Hz contains the next notch (A#4 =
  // 466.16 Hz), so even the ideal response gives only 11.05 dB there and the
  // FFT estimate scatters 9–12 dB across seeds. The reference is narrowed to
  // the inter-notch shoulder 446–460 Hz (ideal 13.5 dB).
  it('orange has a ≥ 10 dB gap at 440 Hz vs the 446–460 Hz shoulder', () => {
    const psd = welch(gen('orange'), SR, 32768);
    const notch = bandDb(psd, 438, 442);
    const ref = bandDb(psd, 446, 460);
    expect(ref - notch).toBeGreaterThanOrEqual(10);
  });

  it('grey at strength 0 is a flat chain', () => {
    const chain = filterChain('grey', { ...OPTION_DEFAULTS, greyStrength: 0 });
    expect(chain).not.toBeNull();
    for (const spec of chain!) expect(Math.abs(spec[3])).toBe(0);
  });
});

describe('output level and seam', () => {
  it.each(NOISE_TYPES.map((t) => t.id))('%s is bounded, ~0.2 RMS and loops cleanly', (id) => {
    const x = gen(id);
    expect(x.length).toBe(LEN);
    let peak = 0;
    let sum = 0;
    for (const v of x) {
      peak = Math.max(peak, Math.abs(v));
      sum += v * v;
    }
    const rms = Math.sqrt(sum / x.length);
    expect(peak).toBeLessThanOrEqual(1);
    expect(rms).toBeGreaterThanOrEqual(0.18);
    expect(rms).toBeLessThanOrEqual(0.22);
    // Seam: the wrap step x[len-1] → x[0] must look like any other step.
    // (Brief's fixed |Δ| < 0.2 is below the typical step of broadband
    // colors — white/grey/blue/violet average 0.23–0.29 — so it is replaced
    // by the buffer's own 99.9th-percentile step.)
    const steps = new Float64Array(LEN - 1);
    for (let k = 0; k < LEN - 1; k++) steps[k] = Math.abs(x[k + 1]! - x[k]!);
    steps.sort();
    const p999 = steps[Math.floor(steps.length * 0.999)]!;
    expect(Math.abs(x[0]! - x[LEN - 1]!)).toBeLessThanOrEqual(p999);
  });
});

describe('colorSignature', () => {
  it('ignores options belonging to other colors', () => {
    const o1 = { ...OPTION_DEFAULTS };
    const o2 = { ...OPTION_DEFAULTS, greenCenter: 800 };
    expect(colorSignature('blue', o1)).toBe(colorSignature('blue', o2));
    expect(colorSignature('green', o1)).not.toBe(colorSignature('green', o2));
  });
});

describe('filter math', () => {
  it('biquad responses hit their design points', () => {
    expect(biquadMagDb(biquad(['peaking', 1000, 1, 4], SR), 1000, SR)).toBeCloseTo(4, 6);
    expect(biquadMagDb(biquad(['lowpass', 1000, Math.SQRT1_2, 0], SR), 1000, SR)).toBeCloseTo(
      -3.01,
      2,
    );
    expect(biquadMagDb(biquad(['notch', 440, 30, 0], SR), 440, SR)).toBeLessThan(-60);
    expect(biquadMagDb(biquad(['lowshelf', 250, 0.7, 14], SR), 20, SR)).toBeCloseTo(14, 0);
  });

  it('idealDb is 0 dB at 1 kHz for tilted colors and follows the tilt', () => {
    expect(idealDb(getNoise('brown'), 1000, OPTION_DEFAULTS)).toBeCloseTo(0, 9);
    expect(idealDb(getNoise('pink'), 2000, OPTION_DEFAULTS)).toBeCloseTo(-3, 9);
    expect(idealDb(getNoise('orange'), 440, OPTION_DEFAULTS)).toBeCloseTo(-3 * Math.log2(0.44), 9);
  });
});
