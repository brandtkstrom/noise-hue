// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getNoise } from '../noise/catalog';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Settings } from '../types';
import { buildBackground, motionWobble } from '../viz/background';
import { BANDS, wavePath } from '../viz/waveform';
import { DEFAULT_APP_STATE, type AppState } from './app-state';
import { mountViz, type VizEngine } from './viz';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = (sel: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const swatch = (type: string) => el(`button.color-btn[data-type="${type}"] .swatch`);

let frames: FrameRequestCallback[];
let clock: number;
/** Runs the frames queued so far (not ones they queue), advancing the clock by `dt` first. */
function step(dt = 16): void {
  clock += dt;
  const run = frames;
  frames = [];
  for (const f of run) f(clock);
}

const SAMPLES = Array.from({ length: 150 }, (_, i) => Math.sin(i / 10) * 0.2);

function stubEngine() {
  return {
    playing: false,
    readWaveform: vi.fn<VizEngine['readWaveform']>(() => SAMPLES),
    measureBands: vi.fn<VizEngine['measureBands']>(() => BANDS.map(() => -60)),
  } satisfies VizEngine;
}

let settings: Store<Settings>;
let app: Store<AppState>;
let engine: ReturnType<typeof stubEngine>;
let reduced: boolean;
let onFrame: ReturnType<typeof vi.fn<() => void>>;

/** Raw value last assigned to #app's style.background (jsdom normalizes gradients away). */
let bgValue = '';

function mount(s: Partial<Settings> = {}): void {
  bgValue = '';
  Object.defineProperty(el('#app').style, 'background', {
    configurable: true,
    get: () => bgValue,
    set: (v: string) => void (bgValue = v),
  });
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...s });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE });
  engine = stubEngine();
  onFrame = vi.fn<() => void>();
  mountViz({ settings, app, engine, reducedMotion: () => reduced, onFrame });
}

beforeEach(() => {
  document.body.innerHTML = bodyHtml;
  frames = [];
  clock = 0;
  reduced = false;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', () => {});
  vi.spyOn(performance, 'now').mockImplementation(() => clock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('waveform and ring', () => {
  it('while playing: draws the live waveform every frame, shows it, ripples the selected ring', () => {
    mount({ type: 'pink' });
    app.set({ playing: true });
    step();
    expect(engine.readWaveform).toHaveBeenCalledWith(150);
    expect(el('#wave').getAttribute('d')).toBe(wavePath(SAMPLES));
    expect(el('#viz').classList.contains('is-live')).toBe(true);
    expect(el('#wave-svg').getAttribute('aria-label')).toBe('Live waveform of pink noise');
    expect(swatch('pink').classList.contains('ring-ripple')).toBe(true);
    expect(swatch('white').classList.contains('ring-ripple')).toBe(false);
    expect(frames.length).toBe(1);
    const reads = engine.readWaveform.mock.calls.length;
    step();
    expect(engine.readWaveform).toHaveBeenCalledTimes(reads + 1);
    expect(onFrame).toHaveBeenCalled();
  });

  it('when stopped: waveform hidden, no ripple, idle label', () => {
    mount();
    app.set({ playing: true });
    app.set({ playing: false });
    expect(el('#viz').classList.contains('is-live')).toBe(false);
    expect(swatch('white').classList.contains('ring-ripple')).toBe(false);
    expect(el('#wave-svg').getAttribute('aria-label')).toBe('Waveform, idle');
  });

  it('the ripple follows the selected color', () => {
    mount();
    app.set({ playing: true });
    settings.set({ type: 'blue' });
    expect(swatch('blue').classList.contains('ring-ripple')).toBe(true);
    expect(swatch('white').classList.contains('ring-ripple')).toBe(false);
  });
});

describe('compare overlay', () => {
  it('hidden until compare is on', () => {
    mount();
    expect(el('#cmp').hasAttribute('hidden')).toBe(true);
    app.set({ compare: true });
    expect(el('#cmp').hasAttribute('hidden')).toBe(false);
  });

  it('white shows the reference note', () => {
    mount();
    app.set({ compare: true });
    expect(el('#cmp-note').textContent).toBe(
      'White is the flat reference line.\nSelect another color to see its difference.',
    );
  });

  it('paused: ideal curve only, with the press-play note', () => {
    mount({ type: 'brown' });
    app.set({ compare: true });
    expect(el('#cmp-note').textContent).toBe('Dashed: ideal shape\nPress play to measure live');
    expect(el('#cmp-ideal').getAttribute('d')).toMatch(/^M0\.0 /);
    expect(el('#cmp-measured').getAttribute('d')).toBe('');
    expect(el('#cmp-area').getAttribute('d')).toMatch(/^M0 80 L/);
    expect(engine.measureBands).not.toHaveBeenCalled();
  });

  it('playing: measures bands each frame and draws the measured curve', () => {
    mount({ type: 'brown' });
    app.set({ compare: true, playing: true });
    step();
    expect(engine.measureBands).toHaveBeenCalledWith(BANDS);
    expect(el('#cmp-note').textContent).toBe(
      'Solid: measured · Dashed: ideal\nFlat line: white noise',
    );
    expect(el('#cmp-measured').getAttribute('d')).toMatch(/^M/);
  });

  it('playing without compare does not measure', () => {
    mount({ type: 'brown' });
    app.set({ playing: true });
    step();
    expect(engine.measureBands).not.toHaveBeenCalled();
  });
});

describe('background and loop cadence', () => {
  const bg = () => bgValue;

  it('glow follows accent and volume; muted is the plain base color', () => {
    reduced = true;
    mount({ type: 'pink', volume: 80 });
    const expected = buildBackground({
      accent: getNoise('pink').color,
      volume: 80,
      muted: false,
      pan: 0,
      wobble: motionWobble(0, true),
    });
    expect(bg()).toBe(expected);
    expect(bg()).toContain('radial-gradient');
    settings.set({ muted: true });
    expect(bg()).not.toContain('radial-gradient');
  });

  it('stopped with volume 0: no animation frames requested', () => {
    mount({ volume: 0 });
    expect(frames.length).toBe(0);
  });

  it('stopped under reduced motion: renders once, no loop', () => {
    reduced = true;
    mount({ volume: 60 });
    expect(frames.length).toBe(0);
  });

  it('stopped with volume and motion: background ticks at ≤ 30 fps without reading audio', () => {
    mount({ volume: 60 });
    expect(frames.length).toBe(1);
    const first = bg();
    step(500); // the wobble has visibly moved by now
    const moved = bg();
    expect(moved).not.toBe(first);
    step(17); // 17 ms after a draw: skipped, still scheduled
    expect(bg()).toBe(moved);
    expect(frames.length).toBe(1);
    expect(engine.readWaveform).not.toHaveBeenCalled();
  });

  it('a store change inside onFrame leaves exactly one pending frame', () => {
    mount();
    let n = 0;
    onFrame.mockImplementation(() => app.set({ timerLabel: `${++n}m` }));
    app.set({ playing: true });
    expect(frames.length).toBe(1);
    for (let i = 0; i < 5; i++) {
      step();
      expect(frames.length).toBe(1);
    }
    expect(onFrame).toHaveBeenCalledTimes(5);
  });

  it('pausing with volume 0 stops the loop', () => {
    mount({ volume: 0 });
    app.set({ playing: true });
    step();
    expect(frames.length).toBe(1);
    app.set({ playing: false });
    step();
    expect(frames.length).toBe(0);
  });
});
