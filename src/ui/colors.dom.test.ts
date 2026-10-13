// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { DEFAULT_APP_STATE, type AppState } from './app-state';
import { mountColors } from './colors';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = (sel: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const btn = (id: NoiseId): HTMLElement => el(`.color-btn[data-type="${id}"]`);
const dot = (): HTMLElement => el('#title-dot');

let settings: Store<Settings>;
let app: Store<AppState>;

function setup(patch: Partial<Settings> = {}, state: Partial<AppState> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE, ...state });
  mountColors(settings, app);
}

describe('mountColors', () => {
  beforeEach(() => setup());

  it('binds the 8 static buttons without adding any', () => {
    expect(document.querySelectorAll('.color-btn')).toHaveLength(8);
    expect(btn('white').getAttribute('aria-pressed')).toBe('true');
    expect(btn('pink').getAttribute('aria-pressed')).toBe('false');
  });

  it('click sets the type only and never touches playing', () => {
    setup({}, { playing: false });
    btn('brown').click();
    expect(settings.get().type).toBe('brown');
    expect(app.get().playing).toBe(false);
    setup({}, { playing: true });
    btn('blue').click();
    expect(app.get().playing).toBe(true);
    expect(btn('blue').getAttribute('aria-pressed')).toBe('true');
    expect(btn('white').getAttribute('aria-pressed')).toBe('false');
  });

  it('sets --accent, selection line and fold name from the current color', () => {
    expect(el('#app').style.getPropertyValue('--accent')).toBe('#E8E6E3');
    settings.set({ type: 'pink' });
    expect(el('#app').style.getPropertyValue('--accent')).toBe('#F2A7C3');
    expect(el('#sel-name').textContent).toBe('Pink noise');
    expect(el('#sel-slope').textContent).toBe('−3 dB/oct');
    expect(el('#fold-left-name').textContent).toBe('Pink');
  });

  it('replays the dot bounce on type change but not on first render', () => {
    const cls = (): string[] =>
      ['dot-bounce-a', 'dot-bounce-b'].filter((c) => dot().classList.contains(c));
    expect(cls()).toEqual([]);
    settings.set({ type: 'pink' });
    expect(cls()).toEqual(['dot-bounce-a']);
    settings.set({ tilt: 3 });
    expect(cls()).toEqual(['dot-bounce-a']);
    settings.set({ type: 'brown' });
    expect(cls()).toEqual(['dot-bounce-b']);
    settings.set({ type: 'blue' });
    expect(cls()).toEqual(['dot-bounce-a']);
  });

  it('hover/focus peeks a description; leaving restores the current one', () => {
    expect(el('#desc').textContent).toMatch(/^Equal energy at every frequency/);
    btn('brown').dispatchEvent(new MouseEvent('mouseenter'));
    expect(app.get().peekType).toBe('brown');
    expect(el('#desc').textContent).toMatch(/^Deep and rumbling/);
    expect(el('#app').classList.contains('desc-peek')).toBe(true);
    btn('brown').dispatchEvent(new MouseEvent('mouseleave'));
    expect(app.get().peekType).toBeNull();
    expect(el('#desc').textContent).toMatch(/^Equal energy/);
    expect(el('#app').classList.contains('desc-peek')).toBe(false);
    btn('violet').dispatchEvent(new FocusEvent('focus'));
    expect(app.get().peekType).toBe('violet');
    // leaving a different button does not clear another's peek
    btn('brown').dispatchEvent(new FocusEvent('blur'));
    expect(app.get().peekType).toBe('violet');
    btn('violet').dispatchEvent(new FocusEvent('blur'));
    expect(app.get().peekType).toBeNull();
  });
});
