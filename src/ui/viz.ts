import type { NoiseEngine } from '../audio/engine';
import { CONFIG } from '../config';
import { getNoise } from '../noise/catalog';
import { effectiveVolume } from '../state/mappings';
import { optionsOf } from '../state/presets';
import type { Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { buildBackground, motionWobble } from '../viz/background';
import { BANDS, idealArea, idealPath, measuredPaths, wavePath } from '../viz/waveform';
import type { AppState } from './app-state';
import { $, setAttr, setText, toggleClass } from './dom';

export type VizEngine = Pick<NoiseEngine, 'readWaveform' | 'measureBands' | 'playing'>;

const WAVE_POINTS = 150;
/** Background-only motion while stopped: at most ~30 fps. */
const MOTION_FRAME_MS = 33;
const FLAT = 'M0 80 L600 80';

function compareNote(type: NoiseId, playing: boolean): string {
  if (type === 'white') {
    return 'White is the flat reference line.\nSelect another color to see its difference.';
  }
  return playing
    ? 'Solid: measured · Dashed: ideal\nFlat line: white noise'
    : 'Dashed: ideal shape\nPress play to measure live';
}

type Mode = 'live' | 'motion' | 'idle';

/**
 * Visualizer: one rAF loop that draws the waveform, the compare curves and the page glow.
 * Per frame while playing; ≤ 30 fps background-only motion while stopped and audible;
 * otherwise the loop stops after a single render. Also owns the compare overlay's
 * visibility/note, the live waveform state and the selected color's ripple ring.
 */
export function mountViz(deps: {
  settings: Store<Settings>;
  app: Store<AppState>;
  engine: VizEngine;
  reducedMotion: () => boolean;
  /** Called after each loop-drawn frame (main hooks the transport's timer tick here). */
  onFrame?: () => void;
}): { refresh(): void } {
  const { settings, app, engine, reducedMotion, onFrame } = deps;
  const appEl = $('#app');
  const viz = $('#viz');
  const waveSvg = $('#wave-svg');
  const wave = $('#wave');
  const cmp = $('#cmp');
  const cmpArea = $('#cmp-area');
  const cmpIdeal = $('#cmp-ideal');
  const cmpMeasured = $('#cmp-measured');
  const cmpNote = $('#cmp-note');
  const swatches = [
    ...$('#color-list').querySelectorAll<HTMLElement>('button.color-btn[data-type]'),
  ].map((btn) => ({ id: btn.dataset.type as NoiseId, el: $('.swatch', btn) }));

  let raf: number | null = null;
  let lastDraw = -Infinity;
  let bgText = '';
  // the ideal curve depends only on type + options: cache it between frames
  let idealFor: Settings | null = null;
  let ideal = { line: '', area: '' };

  const mode = (): Mode => {
    if (app.get().playing) return 'live';
    const motion = CONFIG.motion.mode === 'waves' && !reducedMotion();
    return motion && effectiveVolume(settings.get()) > 0 ? 'motion' : 'idle';
  };

  function idealCurves(s: Settings): { line: string; area: string } {
    if (idealFor !== s) {
      const info = getNoise(s.type);
      const o = optionsOf(s);
      ideal = { line: idealPath(info, o), area: idealArea(info, o) };
      idealFor = s;
    }
    return ideal;
  }

  /** State-driven parts: overlay visibility and note, live class, ring, labels. */
  function renderState(): void {
    const s = settings.get();
    const { playing, compare } = app.get();
    toggleClass(viz, 'is-live', !CONFIG.hideWaveWhenStopped || playing);
    setAttr(
      waveSvg,
      'aria-label',
      playing ? `Live waveform of ${getNoise(s.type).name.toLowerCase()} noise` : 'Waveform, idle',
    );
    for (const sw of swatches) {
      toggleClass(
        sw.el,
        'ring-ripple',
        playing && sw.id === s.type && CONFIG.ringAnim === 'ripple',
      );
    }
    setAttr(cmp, 'hidden', compare ? null : '');
    if (compare) setText(cmpNote, compareNote(s.type, playing));
  }

  /** Frame-driven parts: waveform, compare curves, background. */
  function draw(now: number): void {
    const s = settings.get();
    const { playing, compare } = app.get();
    const audible = effectiveVolume(s) > 0;

    if (playing) setAttr(wave, 'd', wavePath(engine.readWaveform(WAVE_POINTS)));
    else if (!wave.getAttribute('d')) setAttr(wave, 'd', FLAT);
    // when stopped the last trace is kept while it fades out (#viz loses .is-live)

    if (compare) {
      const curves = idealCurves(s);
      const bands = playing && audible ? engine.measureBands(BANDS) : null;
      const measured = bands ? measuredPaths(bands, getNoise(s.type), optionsOf(s)) : null;
      setAttr(cmpIdeal, 'd', curves.line);
      setAttr(cmpMeasured, 'd', measured ? measured.line : '');
      setAttr(cmpArea, 'd', measured ? measured.area : curves.area);
    }

    const bg = buildBackground({
      accent: getNoise(s.type).color,
      volume: s.volume,
      muted: s.muted,
      pan: s.pan,
      wobble: motionWobble(now / 1000, reducedMotion()),
    });
    if (bg !== bgText) {
      bgText = bg;
      appEl.style.background = bg;
    }
    lastDraw = now;
  }

  function frame(now: number): void {
    raf = null;
    const m = mode();
    if (m === 'idle') return;
    if (m === 'live' || now - lastDraw >= MOTION_FRAME_MS) {
      draw(now);
      // only from the loop, never from a store-triggered refresh (no re-entrant ticks)
      onFrame?.();
    }
    // a store change inside onFrame may already have scheduled the next frame via refresh()
    if (raf === null && mode() !== 'idle') raf = requestAnimationFrame(frame);
  }

  function refresh(): void {
    renderState();
    draw(performance.now());
    if (raf === null && mode() !== 'idle') raf = requestAnimationFrame(frame);
  }

  settings.subscribe(refresh);
  app.subscribe(refresh);
  refresh();
  return { refresh };
}
