// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Settings } from '../types';
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

function stubEngine() {
  let playing = false;
  return {
    get playing() {
      return playing;
    },
    play: vi.fn(() => {
      playing = true;
      return Promise.resolve();
    }),
    pause: vi.fn(() => {
      playing = false;
    }),
    setLevel: vi.fn(),
  } satisfies EnginePort;
}

let settings: Store<Settings>;
let app: Store<AppState>;
let engine: ReturnType<typeof stubEngine>;

function setup(patch: Partial<Settings> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE });
  engine = stubEngine();
  mountTransport({ settings, app, engine });
}

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

  it('a rejected resume reverts to paused', async () => {
    vi.mocked(engine.play).mockImplementationOnce(() => Promise.reject(new Error('no resume')));
    el('#play').click();
    expect(app.get().playing).toBe(true);
    await flush();
    expect(app.get().playing).toBe(false);
    expect(el('#status').textContent?.trim()).toBe('Paused');
  });

  it('a stale resume rejection does not pause a later session', async () => {
    let reject!: (e: Error) => void;
    vi.mocked(engine.play).mockImplementationOnce(() => new Promise<void>((_, r) => (reject = r)));
    el('#play').click();
    el('#play').click();
    el('#play').click();
    reject(new Error('late'));
    await flush();
    expect(app.get().playing).toBe(true);
  });

  it('an AudioContext constructor failure shows #unsupported and stays paused', () => {
    vi.mocked(engine.play).mockImplementationOnce(() => {
      throw new Error('too many contexts');
    });
    expect(isHidden('#unsupported')).toBe(true);
    el('#play').click();
    expect(isHidden('#unsupported')).toBe(false);
    expect(app.get().playing).toBe(false);
    expect(el('#status').textContent?.trim()).toBe('Paused');
  });

  it('play gain is 0 when muted', () => {
    setup({ muted: true });
    el('#play').click();
    expect(engine.play).toHaveBeenCalledWith('white', expect.anything(), 0);
  });

  it('play button label and icons follow playing', () => {
    const play = el('#play');
    expect(play.getAttribute('aria-label')).toBe('Play');
    play.click();
    expect(play.getAttribute('aria-label')).toBe('Pause');
    expect(play.getAttribute('title')).toBe('Pause');
    expect(el('#play .icon-play').hasAttribute('hidden')).toBe(true);
    expect(el('#play .icon-pause').hasAttribute('hidden')).toBe(false);
  });

  it('status reads Paused with data-state paused', () => {
    expect(el('#status').textContent?.trim()).toBe('Paused');
    expect(el('#status').dataset.state).toBe('paused');
  });

  it('status reads Playing · White with data-state playing', () => {
    el('#play').click();
    expect(el('#status').textContent?.trim()).toBe('Playing · White');
    expect(el('#status').dataset.state).toBe('playing');
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
    expect(isHidden('#mute .icon-vol-on')).toBe(true);
    expect(el('#vol-readout').textContent).toBe('Muted');
    mute.click();
    expect(settings.get().muted).toBe(false);
    expect(mute.getAttribute('aria-label')).toBe('Mute');
  });

  it('aria-pressed follows effective volume 0 (Unmute) even when not muted', () => {
    slideVol(0);
    expect(settings.get().muted).toBe(false);
    expect(el('#mute').getAttribute('aria-label')).toBe('Unmute');
    expect(el('#mute').getAttribute('aria-pressed')).toBe('true');
    slideVol(30);
    expect(el('#mute').getAttribute('aria-pressed')).toBe('false');
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

  it('status shows Muted · White with data-state muted while playing muted', () => {
    el('#play').click();
    el('#mute').click();
    expect(el('#status').textContent?.trim()).toBe('Muted · White');
    expect(el('#status').dataset.state).toBe('muted');
  });
});
