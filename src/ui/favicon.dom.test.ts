// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Settings } from '../types';
import { mountFavicon } from './favicon';
import html from '../../index.html?raw';

const headHtml = /<head[^>]*>([\s\S]*)<\/head>/i.exec(html)?.[1] ?? '';

const svgLinks = (): HTMLLinkElement[] => [
  ...document.head.querySelectorAll<HTMLLinkElement>('link[rel="icon"][type="image/svg+xml"]'),
];

const href = (): string => svgLinks()[0]?.getAttribute('href') ?? '';

/** The decoded SVG source of the dynamic icon link. */
const iconSvg = (): string => {
  if (!href().startsWith('data:image/svg+xml,')) throw new Error(`missing icon link: ${href()}`);
  return decodeURIComponent(href().slice('data:image/svg+xml,'.length));
};

let settings: Store<Settings>;

function setup(patch: Partial<Settings> = {}): void {
  document.head.innerHTML = headHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  mountFavicon(settings);
}

describe('mountFavicon', () => {
  beforeEach(() => setup());

  it('takes over the static SVG icon with the current color', () => {
    expect(svgLinks()).toHaveLength(1);
    expect(iconSvg()).toContain('fill="#E8E6E3"');
    expect(href()).not.toContain('#'); // a raw # would truncate the data URL
    // the static default is replaced; the .ico fallback is left alone
    expect(document.head.querySelector('link[href="/favicon.svg"]')).toBeNull();
    expect(document.head.querySelector('link[href="/favicon.ico"]')).not.toBeNull();
  });

  it('follows the selected noise color', () => {
    settings.set({ type: 'pink' });
    expect(svgLinks()).toHaveLength(1);
    expect(iconSvg()).toContain('fill="#F2A7C3"');
    settings.set({ type: 'brown' });
    expect(svgLinks()).toHaveLength(1);
    expect(iconSvg()).toContain('fill="#C49468"');
  });

  it('reflects a restored selection on mount', () => {
    setup({ type: 'blue' });
    expect(svgLinks()).toHaveLength(1);
    expect(iconSvg()).toContain('fill="#7FB2F0"');
  });

  it('does not churn the link on unrelated settings changes', () => {
    const first = svgLinks()[0];
    settings.set({ volume: 42 });
    settings.set({ muted: true });
    expect(svgLinks()).toHaveLength(1);
    expect(svgLinks()[0]).toBe(first);
  });
});
