import { describe, expect, it } from 'vitest';
import { tiltGains, waveParams, widthGains } from './params';

describe('widthGains', () => {
  it('is pure mid at width 0', () => {
    const g = widthGains(0);
    expect(g.c).toBe(1);
    expect(g.s).toBe(0);
  });

  it('is equal mid/side at width 100', () => {
    const g = widthGains(100);
    expect(g.c).toBeCloseTo(0.7071, 4);
    expect(g.s).toBeCloseTo(0.7071, 4);
  });
});

describe('tiltGains', () => {
  it('splits tilt symmetrically between shelves', () => {
    expect(tiltGains(6)).toEqual({ lowDb: -3, highDb: 3 });
    expect(tiltGains(-4)).toEqual({ lowDb: 2, highDb: -2 });
  });
});

describe('waveParams', () => {
  it('maps depth and period to LFO settings', () => {
    const w = waveParams(50, 10);
    expect(w.lfoHz).toBeCloseTo(0.1, 10);
    expect(w.lfoGain).toBeCloseTo(0.25, 10);
    expect(w.base).toBeCloseTo(0.75, 10);
  });

  it('is a constant unity gain at depth 0', () => {
    expect(waveParams(0, 8)).toEqual({ lfoHz: 0.125, lfoGain: 0, base: 1 });
  });
});
