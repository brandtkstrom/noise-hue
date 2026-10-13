import { describe, expect, it } from 'vitest';
import { createSleepTimer, fadeSecondsFor, formatRemaining } from './timer';

const MIN = 60_000;

function setup() {
  let t = 1_000_000;
  const timer = createSleepTimer(() => t);
  return {
    timer,
    advance(ms: number) {
      t += ms;
    },
  };
}

describe('helpers', () => {
  it('fadeSecondsFor', () => {
    expect(fadeSecondsFor(30)).toBe(60);
    expect(fadeSecondsFor(5)).toBe(60);
    expect(fadeSecondsFor(3)).toBeCloseTo(36);
  });
  it('formatRemaining', () => {
    expect(formatRemaining(30_000)).toBe('<1m');
    expect(formatRemaining(27 * MIN - 1)).toBe('27m');
    expect(formatRemaining(27 * MIN)).toBe('27m');
    expect(formatRemaining(60_000)).toBe('1m');
  });
});

describe('sleep timer', () => {
  it('runs, fades once, then finishes once', () => {
    const { timer, advance } = setup();
    timer.set(30, true);
    expect(timer.phase()).toBe('running');
    expect(timer.label()).toBe('30m');
    expect(timer.tick()).toEqual({});
    advance(29 * MIN);
    expect(timer.tick()).toEqual({ startFade: 60 });
    expect(timer.phase()).toBe('fading');
    expect(timer.tick()).toEqual({});
    advance(60_000);
    expect(timer.tick()).toEqual({ finished: true });
    expect(timer.phase()).toBe('off');
    expect(timer.tick()).toEqual({});
    expect(timer.label()).toBeNull();
  });

  it('short timers fade for 20 percent of duration', () => {
    const { timer, advance } = setup();
    timer.set(3, true);
    advance(2 * MIN + 23_000);
    expect(timer.tick()).toEqual({});
    advance(1_000);
    expect(timer.tick()).toEqual({ startFade: 36 });
  });

  it('armed does not count down; onPlay starts it', () => {
    const { timer, advance } = setup();
    timer.set(15, false);
    expect(timer.phase()).toBe('armed');
    expect(timer.label()).toBeNull();
    advance(10 * MIN);
    expect(timer.tick()).toEqual({});
    expect(timer.remainingMs()).toBe(15 * MIN);
    timer.onPlay();
    expect(timer.phase()).toBe('running');
    advance(MIN);
    expect(timer.remainingMs()).toBe(14 * MIN);
  });

  it('onPause while armed stays armed; onPlay while off does nothing', () => {
    const { timer } = setup();
    timer.onPlay();
    expect(timer.phase()).toBe('off');
    timer.set(15, false);
    timer.onPause();
    expect(timer.phase()).toBe('armed');
  });

  it('pause while running cancels', () => {
    const { timer } = setup();
    timer.set(30, true);
    timer.onPause();
    expect(timer.phase()).toBe('off');
  });

  it('pause during fade cancels and resets', () => {
    const { timer, advance } = setup();
    timer.set(30, true);
    advance(29 * MIN + 10_000);
    timer.tick();
    expect(timer.phase()).toBe('fading');
    timer.onPause();
    expect(timer.phase()).toBe('off');
    expect(timer.label()).toBeNull();
    expect(timer.remainingMs()).toBe(0);
  });

  it('re-setting while running restarts; null turns off', () => {
    const { timer, advance } = setup();
    timer.set(30, true);
    advance(29 * MIN + 30_000);
    timer.tick();
    timer.set(45, true);
    expect(timer.phase()).toBe('running');
    expect(timer.remainingMs()).toBe(45 * MIN);
    expect(timer.tick()).toEqual({});
    advance(44 * MIN);
    expect(timer.tick()).toEqual({ startFade: 60 });
    timer.set(null, true);
    expect(timer.phase()).toBe('off');
    expect(timer.label()).toBeNull();
  });
});
