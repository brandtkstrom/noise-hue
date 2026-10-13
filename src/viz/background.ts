import { CONFIG } from '../config';

const BASE = '#0E1116';

export interface Wobble {
  a: number;
  b: number;
}

/** Slow layered sines that gently move the glow. Zeros under reduced motion. */
export function motionWobble(tSec: number, reducedMotion = false): Wobble {
  if (reducedMotion) return { a: 0, b: 0 };
  const amp = CONFIG.motion.intensity;
  const t = tSec * CONFIG.motion.speed;
  return {
    a: amp * (Math.sin(t * 0.6) * 0.6 + Math.sin(t * 1.07 + 1.3) * 0.4),
    b: amp * Math.sin(t * 0.37 + 2),
  };
}

function hexToRgba(hex: string, a: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

function easeStops(hex: string, maxA: number, from: number, to: number, eased: boolean): string {
  const n = eased ? 8 : 1;
  const out: string[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const e = eased ? t * t * (3 - 2 * t) : t;
    out.push(
      `${hexToRgba(hex, (maxA * (1 - e)).toFixed(3))} ${(from + (to - from) * t).toFixed(1)}%`,
    );
  }
  return out.join(', ');
}

export function buildBackground(i: {
  accent: string;
  volume: number;
  muted: boolean;
  pan: number;
  wobble: Wobble;
}): string {
  const v = i.muted ? 0 : i.volume / 100;
  const s = v * v;
  const w = i.wobble;
  const peak = CONFIG.bg.opacity;
  const eased = CONFIG.bg.eased;
  const layers: string[] = [];
  if (s > 0.001) {
    const cx = 50 + (i.pan / 100) * 40 + w.b * 8;
    const ry = (30 + 70 * s) * (1 + w.a * 0.18);
    const rx = 110 + w.b * 12;
    if (w.a || w.b) {
      const cx2 = 50 + (i.pan / 100) * 40 - w.b * 28 + w.a * 10;
      layers.push(
        `radial-gradient(ellipse ${(70 - w.a * 10).toFixed(1)}% ${(ry * 0.75).toFixed(1)}% at ${cx2.toFixed(1)}% 100%, ${easeStops(i.accent, 0.3 * s, 0, 100, eased)})`,
      );
    }
    layers.push(
      `radial-gradient(ellipse ${rx.toFixed(1)}% ${ry.toFixed(1)}% at ${cx.toFixed(1)}% 100%, ${easeStops(i.accent, peak * s, 0, 100, eased)})`,
    );
  }
  layers.push(BASE);
  return layers.join(', ');
}
