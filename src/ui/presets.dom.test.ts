// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS, MAX_PRESETS, OPTION_DEFAULTS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Preset, Settings } from '../types';
import { mountPresets } from './presets';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const chips = (): HTMLElement[] => [
  ...document.querySelectorAll<HTMLElement>('#presets .preset-chip'),
];
const nameInput = (): HTMLInputElement => el<HTMLInputElement>('#preset-name');
const saveBtn = (): HTMLButtonElement => el<HTMLButtonElement>('#preset-save');

function key(target: HTMLElement, k: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

const preset = (id: string, name: string, patch: Partial<Preset> = {}): Preset => ({
  id,
  name,
  type: 'pink',
  options: { ...OPTION_DEFAULTS, tilt: -2, pan: 30 },
  ...patch,
});

let settings: Store<Settings>;
let presets: Store<{ list: Preset[] }>;
let save: ReturnType<typeof vi.fn<(list: Preset[]) => void>>;
let ids: number;

function setup(list: Preset[] = [], patch: Partial<Settings> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  presets = createStore({ list });
  save = vi.fn<(list: Preset[]) => void>();
  ids = 0;
  mountPresets(settings, presets, save, () => `id${++ids}`);
}

describe('mountPresets', () => {
  beforeEach(() => setup());

  it('Save opens a prefilled input; Enter saves a chip named from the input', () => {
    setup([], { type: 'brown', tilt: 3 });
    saveBtn().click();
    expect(nameInput().hidden).toBe(false);
    expect(saveBtn().hidden).toBe(true);
    expect(nameInput().value).toBe('Brown 1');
    expect(document.activeElement).toBe(nameInput());
    nameInput().value = 'Rain';
    key(nameInput(), 'Enter');
    expect(chips()).toHaveLength(1);
    expect(chips()[0]?.querySelector('.preset-name')?.textContent).toBe('Rain');
    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0]?.[0] ?? [];
    expect(saved).toEqual([
      { id: 'id1', name: 'Rain', type: 'brown', options: { ...OPTION_DEFAULTS, tilt: 3 } },
    ]);
    expect(presets.get().list).toEqual(saved);
    expect(nameInput().hidden).toBe(true);
    expect(saveBtn().hidden).toBe(false);
    // just-saved preset matches the current sound
    expect(chips()[0]?.querySelector('.preset-apply')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('Enter or Escape while an IME composition is active does nothing', () => {
    saveBtn().click();
    nameInput().value = '雨';
    for (const k of ['Enter', 'Escape']) {
      const e = new KeyboardEvent('keydown', {
        key: k,
        isComposing: true,
        bubbles: true,
        cancelable: true,
      });
      nameInput().dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(save).not.toHaveBeenCalled();
    expect(nameInput().hidden).toBe(false);
    key(nameInput(), 'Enter');
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('Escape and blur cancel without saving', () => {
    saveBtn().click();
    key(nameInput(), 'Escape');
    expect(nameInput().hidden).toBe(true);
    expect(document.activeElement).toBe(saveBtn());
    saveBtn().click();
    nameInput().dispatchEvent(new FocusEvent('blur'));
    expect(nameInput().hidden).toBe(true);
    expect(save).not.toHaveBeenCalled();
    expect(chips()).toHaveLength(0);
  });

  it('prefill uses the next free number for the color', () => {
    setup([preset('a', 'White 1'), preset('b', 'White 3')]);
    saveBtn().click();
    expect(nameInput().value).toBe('White 2');
  });

  it('a blank name does not save', () => {
    saveBtn().click();
    nameInput().value = '   ';
    key(nameInput(), 'Enter');
    expect(save).not.toHaveBeenCalled();
    expect(chips()).toHaveLength(0);
  });

  it('at 20 presets the Save chip is disabled with a tooltip', () => {
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => preset(`p${i}`, `P ${i}`));
    setup(full);
    expect(saveBtn().disabled).toBe(true);
    expect(saveBtn().title).toBe('Preset limit reached (20)');
    el('#presets .preset-del').click();
    expect(saveBtn().disabled).toBe(false);
    expect(saveBtn().hasAttribute('title')).toBe(false);
  });

  it('applying a chip sets type and options and leaves volume and mute alone', () => {
    setup([preset('a', 'Rain')], { volume: 73, muted: true });
    const set = vi.spyOn(settings, 'set');
    el<HTMLButtonElement>('#presets .preset-apply').click();
    expect(set).toHaveBeenCalledTimes(1);
    const s = settings.get();
    expect(s.type).toBe('pink');
    expect(s.tilt).toBe(-2);
    expect(s.pan).toBe(30);
    expect(s.volume).toBe(73);
    expect(s.muted).toBe(true);
  });

  it('active chip has aria-pressed="true" and clears after a tilt change', () => {
    setup([preset('a', 'Rain'), preset('b', 'Other', { type: 'blue' })]);
    const apply = (): HTMLElement[] => [
      ...document.querySelectorAll<HTMLElement>('#presets .preset-apply'),
    ];
    expect(apply().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    apply()[0]?.click();
    expect(apply().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
    settings.set({ tilt: 5 });
    expect(apply().map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
  });

  it('renders chip dot color, name and a labelled delete button', () => {
    setup([preset('a', 'Rain')]);
    const chip = chips()[0];
    expect(chip?.querySelector<HTMLElement>('.preset-dot')?.style.getPropertyValue('--c')).toBe(
      '#F2A7C3',
    );
    expect(chip?.querySelector('.preset-del')?.getAttribute('aria-label')).toBe(
      'Delete preset Rain',
    );
    // chips live before the Save button
    expect(el('#presets').nextElementSibling).toBe(saveBtn());
  });

  it('delete removes the chip and saves', () => {
    setup([preset('a', 'Rain'), preset('b', 'Wind')]);
    el('#presets .preset-del').click();
    expect(chips().map((c) => c.querySelector('.preset-name')?.textContent)).toEqual(['Wind']);
    expect(save).toHaveBeenCalledWith([preset('b', 'Wind')]);
  });

  it('keeps chip elements across unrelated renders', () => {
    setup([preset('a', 'Rain')]);
    const before = chips()[0];
    settings.set({ tilt: 1 });
    presets.set({ list: [...presets.get().list, preset('b', 'Wind')] });
    expect(chips()[0]).toBe(before);
    expect(chips()).toHaveLength(2);
  });
});
