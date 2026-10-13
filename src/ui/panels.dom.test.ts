// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createStore, type Store } from '../state/store';
import type { UiPrefs } from '../types';
import { DEFAULT_APP_STATE, type AppState } from './app-state';
import { mountPanels } from './panels';
// index.html loaded as text (Vite ?raw); equivalent to readFileSync without needing @types/node
import html from '../../index.html?raw';

const bodyHtml = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? '';

const REQUIRED_IDS = [
  'app',
  'slot-left',
  'rail-left',
  'pane-left',
  'center',
  'title-dot',
  'status',
  'selection',
  'viz',
  'viz-btn',
  'desc',
  'bar',
  'slot-right',
  'rail-right',
  'pane-right',
  'exit-overlay',
  'vol',
  'vol-readout',
  'pan',
  'pan-text',
  'width',
  'width-text',
  'tilt',
  'tilt-text',
  'lowcut',
  'lowcut-text',
  'highcut',
  'highcut-text',
  'wavedepth',
  'wavedepth-text',
  'waveperiod',
  'waveperiod-text',
  'browncorner',
  'browncorner-text',
  'greencenter',
  'greencenter-text',
  'greenwidth',
  'greenwidth-text',
  'greystrength',
  'greystrength-text',
  'orangeq',
  'orangeq-text',
  'orangetune',
  'orangetune-text',
  'grp-color',
  'grp-color-title',
  'grp-tone',
  'grp-space',
  'grp-waves',
  'opts-brown',
  'opts-green',
  'opts-grey',
  'opts-orange',
  'reset',
  'presets',
  'preset-save',
  'play',
  'mute',
  'timer-btn',
  'timer-popover',
  'compare',
  'fullscreen',
  'color-list',
  'pin-left',
  'pin-right',
  'fold-left',
  'fold-right',
  'wave',
  'cmp-area',
  'cmp-ideal',
  'cmp-measured',
  'cmp-note',
  'unsupported',
];

const DEFAULT_UI: UiPrefs = {
  pinLeft: true,
  pinRight: true,
  foldLeft: false,
  foldRight: false,
  sleepMinutes: 30,
};

const el = (sel: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(sel);
  if (!found) throw new Error(`missing ${sel}`);
  return found;
};

let ui: Store<UiPrefs>;
let app: Store<AppState>;

function setup(prefs: Partial<UiPrefs> = {}, state: Partial<AppState> = {}): void {
  document.body.innerHTML = bodyHtml;
  ui = createStore<UiPrefs>({ ...DEFAULT_UI, ...prefs });
  app = createStore<AppState>({ ...DEFAULT_APP_STATE, ...state });
  mountPanels(ui, app);
}

describe('index.html structure', () => {
  beforeEach(() => {
    document.body.innerHTML = bodyHtml;
  });

  it('exposes every id later tasks attach to', () => {
    const missing = REQUIRED_IDS.filter((id) => !document.getElementById(id));
    expect(missing).toEqual([]);
  });

  it('has 8 color buttons in catalog order', () => {
    const types = [...document.querySelectorAll<HTMLElement>('#color-list button.color-btn')].map(
      (b) => b.dataset.type,
    );
    expect(types).toEqual(['white', 'grey', 'brown', 'pink', 'green', 'blue', 'violet', 'orange']);
  });

  it('rails, fold buttons and the exit overlay are buttons; overlays start hidden', () => {
    for (const id of ['rail-left', 'rail-right', 'fold-left', 'fold-right', 'exit-overlay']) {
      expect(el(`#${id}`).tagName).toBe('BUTTON');
    }
    expect(el('#exit-overlay').hidden).toBe(true);
    expect(el('#exit-overlay .exit-hint').textContent).toBe('Click or press any key to exit');
    expect(el('#timer-popover').hidden).toBe(true);
    expect(el('#unsupported').hidden).toBe(true);
  });

  it('each sound group heading has a changed dot', () => {
    for (const id of ['grp-color', 'grp-tone', 'grp-space', 'grp-waves']) {
      expect(el(`#${id} .changed-dot`)).toBeTruthy();
    }
  });
});

describe('mountPanels', () => {
  it('pinned panels render open with --lw/--rw and aria state', () => {
    setup();
    const root = el('#app');
    expect(root.style.getPropertyValue('--lw')).toBe('18.75rem');
    expect(root.style.getPropertyValue('--rw')).toBe('22.5rem');
    expect(el('#slot-left').classList.contains('is-collapsed')).toBe(false);
    expect(el('#pin-left').getAttribute('aria-pressed')).toBe('true');
    expect(el('#fold-left').getAttribute('aria-expanded')).toBe('true');
    expect(root.classList.contains('left-collapsed')).toBe(false);
  });

  it('clicking pin when pinned unpins, collapses and suppresses', () => {
    setup();
    el('#pin-left').click();
    expect(ui.get().pinLeft).toBe(false);
    const slot = el('#slot-left');
    expect(slot.classList.contains('is-collapsed')).toBe(true);
    expect(slot.classList.contains('is-suppressed')).toBe(true);
    expect(app.get().suppressLeft).toBe(true);
    expect(el('#app').style.getPropertyValue('--lw')).toBe('3rem');
    expect(el('#app').classList.contains('left-collapsed')).toBe(true);
    expect(el('#pin-left').getAttribute('aria-pressed')).toBe('false');
  });

  it("unpinning moves focus to that side's rail and keeps the panel suppressed", () => {
    for (const side of ['left', 'right'] as const) {
      setup();
      el(`#pin-${side}`).focus();
      el(`#pin-${side}`).click();
      expect(document.activeElement).toBe(el(`#rail-${side}`));
      expect(el(`#slot-${side}`).classList.contains('is-suppressed')).toBe(true);
    }
  });

  it('clicking pin when unpinned pins without suppressing', () => {
    setup({ pinRight: false });
    el('#pin-right').click();
    expect(ui.get().pinRight).toBe(true);
    expect(el('#slot-right').classList.contains('is-collapsed')).toBe(false);
    expect(app.get().suppressRight).toBe(false);
  });

  it('mouseleave on the slot clears suppression', () => {
    setup();
    el('#pin-left').click();
    el('#slot-left').dispatchEvent(new MouseEvent('mouseleave'));
    expect(el('#slot-left').classList.contains('is-suppressed')).toBe(false);
    expect(app.get().suppressLeft).toBe(false);
  });

  it('mouseleave blurs focus held inside an unpinned slot', () => {
    setup({ pinLeft: false });
    const btn = el('#color-list button.color-btn');
    btn.focus();
    expect(document.activeElement).toBe(btn);
    el('#slot-left').dispatchEvent(new MouseEvent('mouseleave'));
    expect(document.activeElement).not.toBe(btn);
  });

  it('mouseleave keeps focus inside a pinned slot', () => {
    setup();
    const btn = el('#color-list button.color-btn');
    btn.focus();
    el('#slot-left').dispatchEvent(new MouseEvent('mouseleave'));
    expect(document.activeElement).toBe(btn);
  });

  it('focus inside rail opens panel', () => {
    setup({ pinLeft: false }, { suppressLeft: true });
    const slot = el('#slot-left');
    el('#rail-left').focus();
    // the slot matches :focus-within, and keyboard focus lifts a pending suppression
    expect(slot.contains(document.activeElement)).toBe(true);
    expect(slot.classList.contains('is-collapsed')).toBe(true);
    expect(slot.classList.contains('is-suppressed')).toBe(false);
  });

  it('fold button toggles is-folded and aria-expanded', () => {
    setup();
    const fold = el('#fold-right');
    fold.click();
    expect(ui.get().foldRight).toBe(true);
    expect(el('#slot-right').classList.contains('is-folded')).toBe(true);
    expect(fold.getAttribute('aria-expanded')).toBe('false');
    fold.click();
    expect(ui.get().foldRight).toBe(false);
    expect(el('#slot-right').classList.contains('is-folded')).toBe(false);
    expect(fold.getAttribute('aria-expanded')).toBe('true');
  });

  it('folding the color panel sets left-folded on #app', () => {
    setup();
    el('#fold-left').click();
    expect(el('#app').classList.contains('left-folded')).toBe(true);
  });

  it('peekType drives desc-peek on #app', () => {
    setup();
    app.set({ peekType: 'pink' });
    expect(el('#app').classList.contains('desc-peek')).toBe(true);
    app.set({ peekType: null });
    expect(el('#app').classList.contains('desc-peek')).toBe(false);
  });
});
