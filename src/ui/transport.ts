import type { NoiseEngine } from '../audio/engine';
import { CONFIG } from '../config';
import {
  effectiveVolume,
  statusColor,
  statusText,
  volumeGain,
  volumeShort,
  volumeText,
} from '../state/mappings';
import { optionsOf } from '../state/presets';
import type { Store } from '../state/store';
import type { SleepTimer } from '../state/timer';
import type { Settings, UiPrefs } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setText, toggleClass } from './dom';
import { mountTimerPopover } from './timer-popover';

export type EnginePort = Pick<
  NoiseEngine,
  'play' | 'pause' | 'setLevel' | 'fadeOut' | 'cancelFade' | 'playing'
>;

const setHidden = (el: Element, hidden: boolean): void => setAttr(el, 'hidden', hidden ? '' : null);

/** Keys that move focus or are modifiers; every other key on the exit overlay exits. */
const PASS_KEYS = new Set(['Tab', 'Shift', 'Meta', 'Control', 'Alt']);

/**
 * Playback bar: play/pause, mute + volume, compare, sleep timer, fullscreen and status.
 * The engine level is not set here (main subscribes the engine to settings).
 */
export function mountTransport(deps: {
  settings: Store<Settings>;
  ui: Store<UiPrefs>;
  app: Store<AppState>;
  engine: EnginePort;
  timer: SleepTimer;
}): { tick(): void } {
  const { settings, ui, app, engine, timer } = deps;
  const appEl = $('#app');
  const playBtn = $('#play');
  const iconPlay = $('.icon-play', playBtn);
  const iconPause = $('.icon-pause', playBtn);
  const status = $('#status');
  const muteBtn = $('#mute');
  const iconMuted = $('.icon-vol-muted', muteBtn);
  const iconLow = $('.icon-vol-low', muteBtn);
  const iconHigh = $('.icon-vol-high', muteBtn);
  const vol = $('#vol') as HTMLInputElement;
  const readout = $('#vol-readout');
  const compareBtn = $('#compare');
  const vizBtn = $('#viz-btn');
  const fsBtn = $('#fullscreen');
  const overlay = $('#exit-overlay');

  const popover = mountTimerPopover({
    ui,
    app,
    timer,
    // re-choosing (Off or a new length) mid-fade: drop the fade, keep playing at full level
    onAbortFade() {
      session++;
      engine.cancelFade();
    },
  });

  let lastVolume = settings.get().volume > 0 ? settings.get().volume : CONFIG.defaultVolume;
  /** Bumped on every play/pause so a stale fade resolution can't pause a later session. */
  let session = 0;
  let statusHex = '';

  // ── play / pause ──
  function play(): void {
    const s = settings.get();
    session++;
    // must run synchronously inside the click (autoplay gesture requirement)
    engine.play(s.type, optionsOf(s), volumeGain(s.volume, s.muted)).catch(() => {});
    app.set({ playing: true });
    timer.onPlay();
    popover.sync();
  }

  function pause(): void {
    session++;
    engine.pause();
    app.set({ playing: false });
    timer.onPause();
    popover.sync();
  }

  playBtn.addEventListener('click', () => (app.get().playing ? pause() : play()));

  // ── volume / mute ──
  vol.addEventListener('input', () => {
    settings.set({ volume: Number(vol.value), muted: false });
  });

  muteBtn.addEventListener('click', () => {
    const s = settings.get();
    if (s.muted) settings.set({ muted: false });
    else if (s.volume === 0) settings.set({ volume: lastVolume });
    else settings.set({ muted: true });
  });

  // ── compare ──
  const toggleCompare = (): void => app.set({ compare: !app.get().compare });
  compareBtn.addEventListener('click', toggleCompare);
  vizBtn.addEventListener('click', toggleCompare);

  // ── fullscreen / immersive ──
  function enterImmersive(): void {
    app.set({ immersive: true });
    setHidden(overlay, false);
    overlay.focus({ preventScroll: true });
    try {
      const root = document.documentElement;
      if (typeof root.requestFullscreen === 'function' && !document.fullscreenElement) {
        root.requestFullscreen().catch(() => {});
      }
    } catch {
      // best effort: immersive mode works without browser fullscreen
    }
  }

  function exitImmersive(): void {
    if (!app.get().immersive) return;
    app.set({ immersive: false });
    setHidden(overlay, true);
    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
    fsBtn.focus({ preventScroll: true });
  }

  fsBtn.addEventListener('click', enterImmersive);
  overlay.addEventListener('click', exitImmersive);
  overlay.addEventListener('keydown', (e) => {
    if (PASS_KEYS.has(e.key)) return;
    e.preventDefault();
    exitImmersive();
  });
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) exitImmersive();
  });

  // ── render ──
  function render(): void {
    const s = settings.get();
    const a = app.get();
    const eff = effectiveVolume(s);

    const label = a.playing ? 'Pause' : 'Play';
    setAttr(playBtn, 'aria-label', label);
    setAttr(playBtn, 'title', label);
    setHidden(iconPlay, a.playing);
    setHidden(iconPause, !a.playing);
    toggleClass(playBtn, 'play-ripple', a.playing);

    if (vol.value !== String(s.volume)) vol.value = String(s.volume);
    setAttr(vol, 'aria-valuetext', volumeText(s));
    setText(readout, volumeShort(s));
    const muteLabel = eff === 0 ? 'Unmute' : 'Mute';
    setAttr(muteBtn, 'aria-pressed', s.muted ? 'true' : 'false');
    setAttr(muteBtn, 'aria-label', muteLabel);
    setAttr(muteBtn, 'title', muteLabel);
    setHidden(iconMuted, eff !== 0);
    setHidden(iconLow, !(eff > 0 && s.volume < 50));
    setHidden(iconHigh, !(eff >= 50));

    const cmp = a.compare ? 'true' : 'false';
    setAttr(compareBtn, 'aria-pressed', cmp);
    setAttr(vizBtn, 'aria-pressed', cmp);

    toggleClass(appEl, 'is-immersive', a.immersive);
    toggleClass(appEl, 'is-audible', a.immersive && a.playing && eff > 0);

    setText(status, statusText(a.playing, s, a.timerLabel));
    const color = statusColor(a.playing, s);
    if (color !== statusHex) {
      statusHex = color;
      status.style.color = color;
    }
  }

  settings.subscribe((next) => {
    if (next.volume > 0) lastVolume = next.volume;
    render();
  });
  app.subscribe(render);
  render();

  return {
    tick() {
      const r = timer.tick();
      if (r.finished) {
        if (app.get().playing) pause();
      } else if (r.startFade !== undefined) {
        const mine = session;
        void engine.fadeOut(r.startFade).then((res) => {
          if (res === 'done' && mine === session && app.get().playing) pause();
        });
      }
      popover.sync();
    },
  };
}
