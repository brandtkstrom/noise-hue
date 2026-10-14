import { describe, expect, it } from 'vitest';
import { buildBackground, motionWobble } from './background';

const base = { accent: '#E8E6E3', volume: 100, muted: false, pan: 0, wobble: { a: 0, b: 0 } };

describe('background', () => {
  it('is solid base at zero volume or muted', () => {
    expect(buildBackground({ ...base, volume: 0 })).toBe('#0E1116');
    expect(buildBackground({ ...base, muted: true })).toBe('#0E1116');
  });
  it('full volume glow', () => {
    const bg = buildBackground(base);
    expect(bg).toContain('radial-gradient(');
    expect(bg).toContain('rgba(232,230,227,0.200)');
    expect(bg.endsWith(', #0E1116')).toBe(true);
    expect(bg).not.toContain('oklab');
  });
  it('pan moves the center', () => {
    expect(buildBackground({ ...base, pan: -100 })).toContain('at 10.0% 100%');
  });
  it('wobble adds a secondary ellipse', () => {
    const n = (s: string) => s.split('radial-gradient(').length - 1;
    expect(n(buildBackground({ ...base, wobble: { a: 0.2, b: 0.1 } }))).toBe(2);
    expect(n(buildBackground(base))).toBe(1);
  });
  it('motionWobble', () => {
    expect(motionWobble(5, true)).toEqual({ a: 0, b: 0 });
    expect(motionWobble(0)).toEqual({ a: 0.5 * 0.4 * Math.sin(1.3), b: 0.5 * Math.sin(2) });
  });
});
