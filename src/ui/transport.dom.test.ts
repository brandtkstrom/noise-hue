// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, DEFAULT_UI } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import { createSleepTimer, type SleepTimer } from '../state/timer';
import type { Settings, UiPrefs } from '../types';
import { DEFAULT_APP_STATE, type AppState } from './app-state';
import { mountTransport, type EnginePort } from './transport';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const isHidden = (sel: string): boolean => el(sel).hasAttribute('hidden');

function key(target: HTMLElement, k: string): KeyboardEvent {
  const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
}

interface StubEngine extends EnginePort {
  fadeResolve: ((r: 'done' | 'cancelled') => void) | null;
}

function stubEngine(): StubEngine {
  let playing = false;
  const eng: StubEngine = {
    get playing() {
      return playing;
    },
    fadeResolve: null,
    play: vi.fn(() => {
      playing = true;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      playing = false;
    }),
    setLevel: vi.fn(),
    fadeOut: vi.fn(
      () =>
        new Promise<'done' | 'cancelled'>((resolve) => {
          eng.fadeResolve = resolve;
        }),
    ),
  };
  return eng;
}

let settings: Store<Settings>;
let ui: Store<UiPrefs>;
let app: Store<AppState>;
let engine: StubEngine;
let timer: SleepTimer;
let clock: number;
let t: { tick(): void };

function setup(patch: Partial<Settings> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  ui = createStore<UiPrefs>({ ...DEFAULT_UI });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE });
  engine = stubEngine();
  clock = 0;
  timer = createSleepTimer(() => clock);
  t = mountTransport({ settings, ui, app, engine, timer });
}

const openPopover = (): void => el('#timer-btn').click();
const chooseMinutes = (m: number): void => el(`.timer-opt[data-minutes="${m}"]`).click();
const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

describe('mountTransport: play/pause', () => {
  beforeEach(() => setup());

  it('play click calls engine.play once and sets app.playing', () => {
    el('#play').click();
    expect(engine.play).toHaveBeenCalledTimes(1);
    expect(engine.play).toHaveBeenCalledWith(
      'white',
      expect.objectContaining({ tilt: 0 }),
      expect.any(Number),
    );
    expect(app.get().playing).toBe(true);
  });

  it('second click pauses', () => {
    el('#play').click();
    el('#play').click();
    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(app.get().playing).toBe(false);
  });

  it('play gain is 0 when muted', () => {
    setup({ muted: true });
    el('#play').click();
    expect(engine.play).toHaveBeenCalledWith('white', expect.anything(), 0);
  });

  it('play button label, icons and ripple follow playing', () => {
    const play = el('#play');
    expect(play.getAttribute('aria-label')).toBe('Play');
    expect(play.classList.contains('play-ripple')).toBe(false);
    play.click();
    expect(play.getAttribute('aria-label')).toBe('Pause');
    expect(play.getAttribute('title')).toBe('Pause');
    expect(el('#play .icon-play').hasAttribute('hidden')).toBe(true);
    expect(el('#play .icon-pause').hasAttribute('hidden')).toBe(false);
    expect(play.classList.contains('play-ripple')).toBe(true);
  });

  it('status reads Paused with color #F2867E', () => {
    expect(el('#status').textContent).toBe('Paused');
    expect(el('#status').style.color).toBe('rgb(242, 134, 126)');
  });

  it('status reads Playing · White with the playing color', () => {
    el('#play').click();
    expect(el('#status').textContent).toBe('Playing · White');
    expect(el('#status').style.color).toBe('rgb(116, 214, 154)');
  });
});

describe('mountTransport: volume and mute', () => {
  beforeEach(() => setup());

  function slideVol(v: number): void {
    const r = el<HTMLInputElement>('#vol');
    r.value = String(v);
    r.dispatchEvent(new Event('input', { bubbles: true }));
  }

  it('slider input sets volume, unmutes and updates the readout', () => {
    settings.set({ muted: true });
    slideVol(30);
    expect(settings.get().volume).toBe(30);
    expect(settings.get().muted).toBe(false);
    expect(el('#vol-readout').textContent).toBe('30%');
    expect(el('#vol').getAttribute('aria-valuetext')).toBe('30%');
  });

  it('mute toggles muted and the icon, label and aria-pressed', () => {
    const mute = el('#mute');
    mute.click();
    expect(settings.get().muted).toBe(true);
    expect(mute.getAttribute('aria-pressed')).toBe('true');
    expect(mute.getAttribute('aria-label')).toBe('Unmute');
    expect(isHidden('#mute .icon-vol-muted')).toBe(false);
    expect(isHidden('#mute .icon-vol-high')).toBe(true);
    expect(el('#vol-readout').textContent).toBe('Muted');
    mute.click();
    expect(settings.get().muted).toBe(false);
    expect(mute.getAttribute('aria-label')).toBe('Mute');
  });

  it('low icon below 50', () => {
    slideVol(20);
    expect(isHidden('#mute .icon-vol-low')).toBe(false);
    expect(isHidden('#mute .icon-vol-high')).toBe(true);
  });

  it('unmuting at volume 0 restores the last non-zero volume', () => {
    slideVol(70);
    slideVol(0);
    expect(el('#mute').getAttribute('aria-label')).toBe('Unmute');
    el('#mute').click();
    expect(settings.get().volume).toBe(70);
    expect(settings.get().muted).toBe(false);
  });

  it('unmuting at volume 0 with no history restores 50', () => {
    setup({ volume: 0 });
    el('#mute').click();
    expect(settings.get().volume).toBe(50);
  });

  it('status shows Muted while playing muted', () => {
    el('#play').click();
    el('#mute').click();
    expect(el('#status').textContent).toBe('Muted · White');
    expect(el('#status').style.color).toBe('rgb(235, 198, 106)');
  });
});

describe('mountTransport: compare', () => {
  beforeEach(() => setup());

  it('compare button and waveform toggle app.compare', () => {
    el('#compare').click();
    expect(app.get().compare).toBe(true);
    expect(el('#compare').getAttribute('aria-pressed')).toBe('true');
    expect(el('#viz-btn').getAttribute('aria-pressed')).toBe('true');
    el('#viz-btn').click();
    expect(app.get().compare).toBe(false);
    expect(el('#compare').getAttribute('aria-pressed')).toBe('false');
  });
});

describe('mountTransport: sleep timer', () => {
  beforeEach(() => setup());

  it('timer button has no aria-haspopup and toggles aria-expanded', () => {
    const btn = el('#timer-btn');
    expect(btn.hasAttribute('aria-haspopup')).toBe(false);
    openPopover();
    expect(isHidden('#timer-popover')).toBe(false);
    expect(btn.getAttribute('aria-expanded')).toBe('true');
    openPopover();
    expect(isHidden('#timer-popover')).toBe(true);
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('popover Esc returns focus', () => {
    openPopover();
    const opt = el('.timer-opt[data-minutes="30"]');
    opt.focus();
    key(opt, 'Escape');
    expect(isHidden('#timer-popover')).toBe(true);
    expect(document.activeElement).toBe(el('#timer-btn'));
    expect(el('#timer-btn').getAttribute('aria-expanded')).toBe('false');
  });

  it('outside click closes the popover', () => {
    openPopover();
    el('#status').click();
    expect(isHidden('#timer-popover')).toBe(true);
  });

  it('click inside the popover keeps it open', () => {
    openPopover();
    el('.timer-title').click();
    expect(isHidden('#timer-popover')).toBe(false);
  });

  it('choosing 15 while paused arms the timer; label 15m only after play', () => {
    openPopover();
    chooseMinutes(15);
    expect(isHidden('#timer-popover')).toBe(true);
    expect(timer.phase()).toBe('armed');
    expect(ui.get().sleepMinutes).toBe(15);
    const btn = el('#timer-btn');
    expect(btn.getAttribute('aria-pressed')).toBe('true');
    expect(isHidden('#timer-label')).toBe(true);
    expect(el('#timer-label').textContent).not.toBe('15m');
    expect(el('#status').textContent).toBe('Paused');
    el('#play').click();
    expect(el('#timer-label').textContent).toBe('15m');
    expect(isHidden('#timer-label')).toBe(false);
    expect(el('#status').textContent).toBe('Playing · White · 15m left');
    expect(app.get().timerLabel).toBe('15m');
  });

  it('tick updates the countdown', () => {
    el('#play').click();
    openPopover();
    chooseMinutes(30);
    clock += 3 * 60_000 + 1;
    t.tick();
    expect(el('#timer-label').textContent).toBe('27m');
    expect(el('#status').textContent).toBe('Playing · White · 27m left');
  });

  it('selected option is aria-pressed; Off is pressed when no timer', () => {
    openPopover();
    expect(el('.timer-opt[data-minutes="0"]').getAttribute('aria-pressed')).toBe('true');
    chooseMinutes(45);
    expect(el('.timer-opt[data-minutes="45"]').getAttribute('aria-pressed')).toBe('true');
    expect(el('.timer-opt[data-minutes="0"]').getAttribute('aria-pressed')).toBe('false');
  });

  it('Off cancels the timer without changing sleepMinutes', () => {
    openPopover();
    chooseMinutes(45);
    openPopover();
    chooseMinutes(0);
    expect(timer.phase()).toBe('off');
    expect(ui.get().sleepMinutes).toBe(45);
    expect(el('#timer-btn').getAttribute('aria-pressed')).toBe('false');
  });

  it('custom minutes apply on submit and are remembered', () => {
    openPopover();
    const input = el<HTMLInputElement>('#timer-custom');
    expect(input.value).toBe('30');
    input.value = '120';
    el<HTMLFormElement>('#timer-custom-form').requestSubmit();
    expect(timer.phase()).toBe('armed');
    expect(ui.get().sleepMinutes).toBe(120);
    expect(isHidden('#timer-popover')).toBe(true);
    expect(document.activeElement).toBe(el('#timer-btn'));
  });

  it('custom minutes out of range are rejected', () => {
    openPopover();
    const input = el<HTMLInputElement>('#timer-custom');
    const form = el<HTMLFormElement>('#timer-custom-form');
    // native constraint validation (min/max/step) blocks the submit
    input.value = '481';
    form.requestSubmit();
    expect(timer.phase()).toBe('off');
    expect(isHidden('#timer-popover')).toBe(false);
    // the JS guard still rejects if a submit gets through
    for (const v of ['0', '481', '2.5', '']) {
      input.value = v;
      form.dispatchEvent(new Event('submit', { cancelable: true }));
      expect(timer.phase()).toBe('off');
      expect(input.getAttribute('aria-invalid')).toBe('true');
    }
    expect(isHidden('#timer-popover')).toBe(false);
  });

  it('manual pause cancels a running timer', () => {
    el('#play').click();
    openPopover();
    chooseMinutes(15);
    el('#play').click();
    expect(timer.phase()).toBe('off');
    expect(el('#timer-btn').getAttribute('aria-pressed')).toBe('false');
    expect(isHidden('#timer-label')).toBe(true);
  });

  it('startFade calls engine.fadeOut and pauses when it resolves done', async () => {
    el('#play').click();
    openPopover();
    chooseMinutes(15);
    clock += 14 * 60_000;
    t.tick();
    expect(engine.fadeOut).toHaveBeenCalledWith(60);
    expect(app.get().playing).toBe(true);
    engine.fadeResolve?.('done');
    await flush();
    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(app.get().playing).toBe(false);
  });

  it('a cancelled fade does not pause', async () => {
    el('#play').click();
    openPopover();
    chooseMinutes(15);
    clock += 14 * 60_000;
    t.tick();
    engine.fadeResolve?.('cancelled');
    await flush();
    expect(engine.pause).not.toHaveBeenCalled();
    expect(app.get().playing).toBe(true);
  });

  it('finished (even with startFade after a clock jump) pauses immediately', () => {
    el('#play').click();
    openPopover();
    chooseMinutes(15);
    clock += 60 * 60_000;
    t.tick();
    expect(engine.fadeOut).not.toHaveBeenCalled();
    expect(engine.pause).toHaveBeenCalledTimes(1);
    expect(app.get().playing).toBe(false);
    expect(timer.phase()).toBe('off');
    expect(el('#status').textContent).toBe('Paused');
  });
});

describe('mountTransport: fullscreen', () => {
  beforeEach(() => setup());

  it('fullscreen exits on key', () => {
    el('#fullscreen').click();
    expect(el('#app').classList.contains('is-immersive')).toBe(true);
    expect(app.get().immersive).toBe(true);
    const overlay = el('#exit-overlay');
    expect(overlay.hasAttribute('hidden')).toBe(false);
    expect(document.activeElement).toBe(overlay);
    for (const k of ['Tab', 'Shift', 'Meta', 'Control', 'Alt']) {
      const e = key(overlay, k);
      expect(e.defaultPrevented).toBe(false);
      expect(el('#app').classList.contains('is-immersive')).toBe(true);
    }
    const e = key(overlay, 'a');
    expect(e.defaultPrevented).toBe(true);
    expect(el('#app').classList.contains('is-immersive')).toBe(false);
    expect(overlay.hasAttribute('hidden')).toBe(true);
  });

  it('clicking the overlay exits', () => {
    el('#fullscreen').click();
    el('#exit-overlay').click();
    expect(app.get().immersive).toBe(false);
  });

  it('requests browser fullscreen best effort and exits it', async () => {
    const root = document.documentElement;
    let fsEl: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => fsEl });
    const request = vi.fn(() => {
      fsEl = root;
      return Promise.resolve();
    });
    const exit = vi.fn(() => {
      fsEl = null;
      return Promise.resolve();
    });
    Object.defineProperty(root, 'requestFullscreen', { configurable: true, value: request });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: exit });
    try {
      el('#fullscreen').click();
      expect(request).toHaveBeenCalledTimes(1);
      key(el('#exit-overlay'), 'Escape');
      expect(exit).toHaveBeenCalledTimes(1);
    } finally {
      delete (document as { fullscreenElement?: unknown }).fullscreenElement;
      delete (root as { requestFullscreen?: unknown }).requestFullscreen;
      delete (document as { exitFullscreen?: unknown }).exitFullscreen;
    }
  });

  it('a rejected fullscreen request still enters immersive mode', async () => {
    const root = document.documentElement;
    Object.defineProperty(root, 'requestFullscreen', {
      configurable: true,
      value: () => Promise.reject(new Error('denied')),
    });
    try {
      el('#fullscreen').click();
      await flush();
      expect(app.get().immersive).toBe(true);
    } finally {
      delete (root as { requestFullscreen?: unknown }).requestFullscreen;
    }
  });

  it('leaving browser fullscreen exits immersive mode', () => {
    el('#fullscreen').click();
    document.dispatchEvent(new Event('fullscreenchange'));
    expect(app.get().immersive).toBe(false);
    expect(isHidden('#exit-overlay')).toBe(true);
  });

  it('is-audible only while immersive, playing and audible', () => {
    const appEl = el('#app');
    el('#play').click();
    expect(appEl.classList.contains('is-audible')).toBe(false);
    el('#fullscreen').click();
    expect(appEl.classList.contains('is-audible')).toBe(true);
    settings.set({ muted: true });
    expect(appEl.classList.contains('is-audible')).toBe(false);
    settings.set({ muted: false, volume: 0 });
    expect(appEl.classList.contains('is-audible')).toBe(false);
    settings.set({ volume: 40 });
    expect(appEl.classList.contains('is-audible')).toBe(true);
    key(el('#exit-overlay'), 'x');
    expect(appEl.classList.contains('is-audible')).toBe(false);
  });
});
