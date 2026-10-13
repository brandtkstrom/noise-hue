import type { NoiseInfo } from '../noise/catalog';
import { idealDb } from '../audio/generators';
import type { SoundOptions } from '../types';

const DB_RANGE = 36;
const FLAT = 'M0 80 L600 80';

export interface Band {
  lo: number;
  hi: number;
  f: number;
}

/** 28 log-spaced analysis bands, 40 Hz to 16 kHz. */
export const BANDS: readonly Band[] = (() => {
  const out: Band[] = [];
  const n = 28;
  const r = Math.pow(16000 / 40, 1 / n);
  for (let i = 0; i < n; i++) {
    const lo = 40 * Math.pow(r, i);
    const hi = lo * r;
    out.push({ lo, hi, f: Math.sqrt(lo * hi) });
  }
  return out;
})();

export function freqToX(f: number): number {
  return (600 * Math.log(f / 20)) / Math.log(1000);
}

export function dbToY(db: number): number {
  const c = Math.max(-DB_RANGE, Math.min(DB_RANGE, db));
  return 80 - c * (72 / DB_RANGE);
}

const pt = (p: number[]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
const poly = (pts: number[][]) => pts.map((p, i) => (i ? 'L' : 'M') + pt(p)).join(' ');

export function wavePath(samples: number[] | null): string {
  if (!samples || samples.length === 0) return FLAT;
  const n = samples.length;
  return poly(
    samples.map((v, i) => [
      n > 1 ? (i / (n - 1)) * 600 : 0,
      80 - Math.max(-1, Math.min(1, v * 2.4)) * 74,
    ]),
  );
}

function idealPoints(info: NoiseInfo, o: SoundOptions): number[][] {
  const pts: number[][] = [];
  for (let q = 0; q <= 80; q++) {
    const f = 20 * Math.pow(1000, q / 80);
    pts.push([freqToX(f), dbToY(idealDb(info, f, o))]);
  }
  return pts;
}

export function idealPath(info: NoiseInfo, o: SoundOptions): string {
  return poly(idealPoints(info, o));
}

/** Filled area between the midline and the ideal curve (no measurement available). */
export function idealArea(info: NoiseInfo, o: SoundOptions): string {
  return 'M0 80 ' + idealPoints(info, o).map((p) => 'L' + pt(p)).join(' ') + ' L600 80 Z';
}

/** Measured band levels (dB), offset to the ideal curve's average, as a line and a delta area. */
export function measuredPaths(
  bands: number[],
  info: NoiseInfo,
  o: SoundOptions,
): { line: string; area: string } {
  const ideal = BANDS.map((b) => idealDb(info, b.f, o));
  let offset = 0;
  for (let m = 0; m < BANDS.length; m++) offset += ideal[m] - bands[m];
  offset /= BANDS.length;
  const pts = BANDS.map((b, m) => [freqToX(b.f), dbToY(bands[m] + offset)]);
  const x0 = (pts[0] ?? [0])[0] ?? 0;
  const x1 = (pts[pts.length - 1] ?? [600])[0] ?? 600;
  return {
    line: poly(pts),
    area: `M${x0.toFixed(1)} 80 ` + pts.map((p) => 'L' + pt(p)).join(' ') + ` L${x1.toFixed(1)} 80 Z`,
  };
}
