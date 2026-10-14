// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeAudioContext } from './audio/fake-context.test-util';
import html from '../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

let visibility: DocumentVisibilityState = 'visible';

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', () => 0);
  vi.stubGlobal('cancelAnimationFrame', () => {});
  localStorage.clear();
  document.body.innerHTML = bodyHtml;
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  delete (document as { visibilityState?: unknown }).visibilityState;
});

const savedType = (): string | undefined => {
  const raw = localStorage.getItem('noisehue:settings');
  return raw ? (JSON.parse(raw) as { type?: string }).type : undefined;
};

const isDisabled = (sel: string): boolean =>
  (document.querySelector(sel) as HTMLButtonElement | HTMLInputElement).disabled;

describe('main: saving', () => {
  it('flushes debounced saves when the page becomes hidden', async () => {
    await import('./main');
    document.querySelector<HTMLElement>('button.color-btn[data-type="brown"]')?.click();
    expect(savedType()).not.toBe('brown'); // still debounced
    document.dispatchEvent(new Event('visibilitychange'));
    expect(savedType()).not.toBe('brown'); // still visible: nothing forced
    visibility = 'hidden';
    document.dispatchEvent(new Event('visibilitychange'));
    expect(savedType()).toBe('brown');
  });

  it('still flushes on pagehide', async () => {
    await import('./main');
    document.querySelector<HTMLElement>('button.color-btn[data-type="pink"]')?.click();
    dispatchEvent(new Event('pagehide'));
    expect(savedType()).toBe('pink');
  });
});

describe('main: no Web Audio', () => {
  it('shows the unsupported notice and disables the audio controls', async () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    await import('./main');
    expect(document.querySelector<HTMLElement>('#unsupported')?.hidden).toBe(false);
    for (const sel of ['#play', '#timer-btn', '#mute', '#vol']) {
      expect(isDisabled(sel)).toBe(true);
    }
  });
});

describe('main: Web Audio available', () => {
  it('keeps the audio controls enabled and starts playback on the fake context', async () => {
    vi.stubGlobal('AudioContext', FakeAudioContext);
    await import('./main');
    expect(document.querySelector<HTMLElement>('#unsupported')?.hidden).toBe(true);
    for (const sel of ['#play', '#timer-btn', '#mute', '#vol']) {
      expect(isDisabled(sel)).toBe(false);
    }
    document.querySelector<HTMLButtonElement>('#play')?.click();
    expect(document.querySelector('#play')?.getAttribute('aria-label')).toBe('Pause');
    expect(document.querySelector('#status')?.textContent?.trim()).toBe('Playing · White');
  });
});
