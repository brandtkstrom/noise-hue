// Test-only spectral analysis helpers (not imported by app code).

/** Deterministic PRNG for reproducible noise in tests. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** In-place iterative radix-2 FFT. `re.length` must be a power of two. */
export function fft(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i]!;
      re[i] = re[j]!;
      re[j] = tr;
      const ti = im[i]!;
      im[i] = im[j]!;
      im[j] = ti;
    }
  }
  for (let size = 2; size <= n; size <<= 1) {
    const half = size >> 1;
    const ang = (-2 * Math.PI) / size;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let start = 0; start < n; start += size) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < half; k++) {
        const a = start + k;
        const b = a + half;
        const xr = re[b]! * cr - im[b]! * ci;
        const xi = re[b]! * ci + im[b]! * cr;
        re[b] = re[a]! - xr;
        im[b] = im[a]! - xi;
        re[a] = re[a]! + xr;
        im[a] = im[a]! + xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Psd {
  /** Power per bin (arbitrary units), bins 0..N/2. */
  power: Float64Array;
  binHz: number;
}

/** Welch averaged periodogram: Hann window, 50 % overlap. */
export function welch(x: Float32Array, sr: number, segment = 4096): Psd {
  const win = new Float64Array(segment);
  for (let i = 0; i < segment; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / segment);
  const power = new Float64Array(segment / 2 + 1);
  const re = new Float64Array(segment);
  const im = new Float64Array(segment);
  const hop = segment / 2;
  let count = 0;
  for (let start = 0; start + segment <= x.length; start += hop) {
    for (let i = 0; i < segment; i++) {
      re[i] = x[start + i]! * win[i]!;
      im[i] = 0;
    }
    fft(re, im);
    for (let k = 0; k <= segment / 2; k++) power[k] = power[k]! + re[k]! ** 2 + im[k]! ** 2;
    count++;
  }
  for (let k = 0; k < power.length; k++) power[k] = power[k]! / count;
  return { power, binHz: sr / segment };
}

/** Mean power density (dB) of bins in [lo, hi] Hz. */
export function bandDb(psd: Psd, lo: number, hi: number): number {
  let sum = 0;
  let n = 0;
  for (let k = Math.ceil(lo / psd.binHz); k * psd.binHz <= hi; k++) {
    sum += psd.power[k]!;
    n++;
  }
  if (n === 0) throw new Error(`empty band ${lo}–${hi}`);
  return 10 * Math.log10(sum / n);
}

/** Mean density (dB) of the octave band centred on fc. */
export function octaveDb(psd: Psd, fc: number): number {
  return bandDb(psd, fc / Math.SQRT2, fc * Math.SQRT2);
}

/**
 * Least-squares slope (dB/octave) of octave-band density at centres
 * fLo·2^k up to fHi (inclusive).
 */
export function slopeDbPerOct(psd: Psd, fLo: number, fHi: number): number {
  const xs: number[] = [];
  const ys: number[] = [];
  for (let fc = fLo; fc <= fHi * 1.0001; fc *= 2) {
    xs.push(Math.log2(fc));
    ys.push(octaveDb(psd, fc));
  }
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    den += (xs[i]! - mx) ** 2;
  }
  return num / den;
}
