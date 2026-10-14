// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { mountColors } from './colors';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = (sel: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const btn = (id: NoiseId): HTMLElement => el(`.color-btn[data-type="${id}"]`);
const activeDesc = (): HTMLElement => el('#desc .desc-item.is-active');

let settings: Store<Settings>;

function setup(patch: Partial<Settings> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  mountColors(settings);
}

describe('mountColors', () => {
  beforeEach(() => setup());

  it('binds the 8 static buttons with white pressed initially', () => {
    expect(document.querySelectorAll('.color-btn')).toHaveLength(8);
    expect(btn('white').getAttribute('aria-pressed')).toBe('true');
    expect(btn('grey').getAttribute('aria-pressed')).toBe('false');
  });

  it('click sets the type and pressed states', () => {
    btn('brown').click();
    expect(settings.get().type).toBe('brown');
    expect(btn('brown').getAttribute('aria-pressed')).toBe('true');
    expect(btn('white').getAttribute('aria-pressed')).toBe('false');
    btn('blue').click();
    expect(settings.get().type).toBe('blue');
    expect(btn('blue').getAttribute('aria-pressed')).toBe('true');
    expect(btn('brown').getAttribute('aria-pressed')).toBe('false');
  });

  it('sets --accent, selection line and description from the current color', () => {
    expect(el('#app').style.getPropertyValue('--accent')).toBe('#E8E6E3');
    expect(el('#sel-name').textContent).toBe('White noise');
    expect(activeDesc().textContent).toMatch(/^Equal energy at every frequency/);
    settings.set({ type: 'pink' });
    expect(el('#app').style.getPropertyValue('--accent')).toBe('#F2A7C3');
    expect(el('#sel-name').textContent).toBe('Pink noise');
    expect(el('#sel-slope').textContent).toBe('−3 dB/oct');
    expect(activeDesc().textContent).toMatch(/^Softer highs/);
  });

  it('keeps every description in the slot with exactly one active', () => {
    const items = document.querySelectorAll('#desc .desc-item');
    expect(items).toHaveLength(8);
    expect(document.querySelectorAll('#desc .desc-item.is-active')).toHaveLength(1);
    btn('green').click();
    const active = document.querySelectorAll('#desc .desc-item.is-active');
    expect(active).toHaveLength(1);
    expect(active[0]?.textContent).toMatch(/^Centered on the middle frequencies/);
    // inactive descriptions stay in the DOM so the slot keeps the tallest height
    expect(items).toHaveLength(8);
  });
});
