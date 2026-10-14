// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Settings } from '../types';
import { DEFAULT_APP_STATE, type AppState } from './app-state';
import { mountImmersive } from './immersive';
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

let settings: Store<Settings>;
let app: Store<AppState>;

function setup(): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE });
  mountImmersive(settings, app);
}

describe('mountImmersive', () => {
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

  it('after Tab moves focus off the overlay, a key still exits', () => {
    el('#fullscreen').click();
    key(el('#exit-overlay'), 'Tab');
    const viz = el('#viz-btn');
    viz.focus();
    const tab = key(viz, 'Tab');
    expect(tab.defaultPrevented).toBe(false);
    expect(app.get().immersive).toBe(true);
    const e = key(viz, 'Escape');
    expect(e.defaultPrevented).toBe(true);
    expect(app.get().immersive).toBe(false);
    expect(isHidden('#exit-overlay')).toBe(true);
    // listener is gone once immersive mode ends
    const later = key(document.body, 'a');
    expect(later.defaultPrevented).toBe(false);
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
      await new Promise((r) => setTimeout(r, 0));
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
    app.set({ playing: true });
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
