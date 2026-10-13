// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
