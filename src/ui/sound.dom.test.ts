// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, OPTION_DEFAULTS } from '../state/defaults';
import { createStore, type Store } from '../state/store';
import type { Settings } from '../types';
import { mountSound } from './sound';
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const el = <T extends HTMLElement = HTMLElement>(sel: string): T => {
  const found = document.querySelector<T>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};
const input = (sel: string): HTMLInputElement => el<HTMLInputElement>(sel);

function slide(sel: string, value: number): void {
  const r = input(sel);
  r.value = String(value);
  r.dispatchEvent(new Event('input', { bubbles: true }));
}

let settings: Store<Settings>;

function setup(patch: Partial<Settings> = {}): void {
  document.body.innerHTML = bodyHtml;
  settings = createStore<Settings>({ ...DEFAULT_SETTINGS, ...patch });
  mountSound(settings);
}

const dotHidden = (grp: string): boolean => el(`${grp} .changed-dot`).hasAttribute('hidden');

describe('mountSound', () => {
  beforeEach(() => setup());

  it('input on #tilt updates the store and the value text', () => {
    slide('#tilt', 6);
    expect(settings.get().tilt).toBe(6);
    expect(el('#tilt-text').textContent).toBe('+6 dB brighter');
    expect(input('#tilt').getAttribute('aria-valuetext')).toBe('+6 dB brighter');
  });

  it('double-click resets that field to its default', () => {
    slide('#tilt', 6);
    input('#tilt').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(settings.get().tilt).toBe(0);
    expect(input('#tilt').value).toBe('0');
    expect(el('#tilt-text').textContent).toBe('Neutral');
  });

  it('Reset keeps the type, sets volume 50, unmutes and restores every option', () => {
    setup({ type: 'brown', volume: 80, muted: true, tilt: 4, pan: 40, brownCorner: 60 });
    el('#reset').click();
    const s = settings.get();
    expect(s.type).toBe('brown');
    expect(s.volume).toBe(50);
    expect(s.muted).toBe(false);
    for (const k of Object.keys(OPTION_DEFAULTS) as (keyof typeof OPTION_DEFAULTS)[]) {
      expect(s[k]).toBe(OPTION_DEFAULTS[k]);
    }
  });

  it('renders initial value text for every slider', () => {
    expect(el('#tilt-text').textContent).toBe('Neutral');
    expect(el('#lowcut-text').textContent).toBe('Off');
    expect(el('#highcut-text').textContent).toBe('Off');
    expect(el('#pan-text').textContent).toBe('Center');
    expect(el('#width-text').textContent).toBe('Mono');
    expect(el('#wavedepth-text').textContent).toBe('Off');
    expect(el('#waveperiod-text').textContent).toBe('8 s per wave');
    expect(el('#browncorner-text').textContent).toBe('levels off at 150 Hz');
    expect(el('#greencenter-text').textContent).toBe('500 Hz');
    expect(el('#greenwidth-text').textContent).toBe('±2.0 octaves');
    expect(el('#greystrength-text').textContent).toBe('100%');
    expect(el('#orangeq-text').textContent).toBe('Narrow');
    expect(el('#orangetune-text').textContent).toBe('A = 440 Hz');
  });

  it('log sliders map positions through the mapping scales', () => {
    slide('#lowcut', 100);
    expect(settings.get().lowCut).toBe(300);
    expect(el('#lowcut-text').textContent).toBe('300 Hz');
    slide('#highcut', 0);
    expect(settings.get().highCut).toBe(2000);
    expect(el('#highcut-text').textContent).toBe('2.0 kHz');
    slide('#greenwidth', 25);
    expect(settings.get().greenWidth).toBe(2.5);
    // slider positions reflect stored values
    setup({ lowCut: 300, brownCorner: 20, greenCenter: 2000 });
    expect(input('#lowcut').value).toBe('100');
    expect(input('#browncorner').value).toBe('0');
    expect(input('#greencenter').value).toBe('100');
    expect(input('#greenwidth').value).toBe('20');
    expect(input('#highcut').value).toBe('100');
  });

  it('keeps the dragged thumb where it is when rounding maps back to another position', () => {
    slide('#lowcut', 1);
    expect(input('#lowcut').value).toBe('1');
  });

  it('pan snaps |v| <= 3 to center', () => {
    slide('#pan', 3);
    expect(settings.get().pan).toBe(0);
    expect(input('#pan').value).toBe('0');
    slide('#pan', -4);
    expect(settings.get().pan).toBe(-4);
    expect(el('#pan-text').textContent).toBe('L 4');
  });

  it('changed dots follow changeFlags and the fold summary counts changes', () => {
    expect(dotHidden('#grp-tone')).toBe(true);
    expect(el('#fold-right-summary').textContent).toBe('Defaults');
    slide('#tilt', 2);
    expect(dotHidden('#grp-tone')).toBe(false);
    expect(dotHidden('#grp-space')).toBe(true);
    slide('#width', 50);
    expect(dotHidden('#grp-space')).toBe(false);
    expect(el('#fold-right-summary').textContent).toBe('2 changed');
    slide('#wavedepth', 30);
    expect(dotHidden('#grp-waves')).toBe(false);
  });

  it('dims Wave length while wave depth is 0', () => {
    expect(el('#field-waveperiod').classList.contains('is-dim')).toBe(true);
    slide('#wavedepth', 20);
    expect(el('#field-waveperiod').classList.contains('is-dim')).toBe(false);
    slide('#wavedepth', 0);
    expect(el('#field-waveperiod').classList.contains('is-dim')).toBe(true);
  });

  it('shows the color group only for colors with color settings', () => {
    expect(el('#grp-color').hidden).toBe(true);
    settings.set({ type: 'green' });
    expect(el('#grp-color').hidden).toBe(false);
    expect(el('#grp-color-title').textContent).toBe('Green settings');
    expect(el('#opts-green').hidden).toBe(false);
    expect(el('#opts-brown').hidden).toBe(true);
    expect(el('#opts-grey').hidden).toBe(true);
    expect(el('#opts-orange').hidden).toBe(true);
    expect(dotHidden('#grp-color')).toBe(true);
    slide('#greencenter', 0);
    expect(settings.get().greenCenter).toBe(200);
    expect(dotHidden('#grp-color')).toBe(false);
    settings.set({ type: 'pink' });
    expect(el('#grp-color').hidden).toBe(true);
  });
});
