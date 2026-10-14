// Pure mappings from sound options to Web Audio graph parameters.

/** Mid/side mix for stereo width: L = c·a + s·b, R = c·a − s·b. */
export function widthGains(width: number): { c: number; s: number } {
  const th = ((width / 100) * Math.PI) / 4;
  return { c: Math.cos(th), s: Math.sin(th) };
}

/** Shelf gains for tilt: low shelf −t/2, high shelf +t/2 (dB). */
export function tiltGains(tilt: number): { lowDb: number; highDb: number } {
  return { lowDb: -tilt / 2, highDb: tilt / 2 };
}

/** Slow volume swell: gain = base + lfoGain · sin(2π · lfoHz · t). */
export function waveParams(
  depth: number,
  period: number,
): { lfoHz: number; lfoGain: number; base: number } {
  return { lfoHz: 1 / period, lfoGain: depth / 200, base: 1 - depth / 200 };
}
