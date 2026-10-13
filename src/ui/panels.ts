import type { Store } from '../state/store';
import type { UiPrefs } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setText, setVar, toggleClass } from './dom';

const PINNED_W = { left: '18.75rem', right: '22.5rem' } as const;
const RAIL_W = '3rem';

type Side = 'left' | 'right';

interface SideKeys {
  pin: 'pinLeft' | 'pinRight';
  fold: 'foldLeft' | 'foldRight';
  suppress: 'suppressLeft' | 'suppressRight';
  widthVar: '--lw' | '--rw';
  pinLabel: [pinned: string, unpinned: string];
  foldAction: string;
}

const KEYS: Record<Side, SideKeys> = {
  left: {
    pin: 'pinLeft',
    fold: 'foldLeft',
    suppress: 'suppressLeft',
    widthVar: '--lw',
    pinLabel: ['Unpin color panel', 'Pin color panel open'],
    foldAction: 'color options',
  },
  right: {
    pin: 'pinRight',
    fold: 'foldRight',
    suppress: 'suppressRight',
    widthVar: '--rw',
    pinLabel: ['Unpin sound panel', 'Pin sound panel open'],
    foldAction: 'sound options',
  },
};

function blurActive(): void {
  const el = document.activeElement;
  if (el instanceof HTMLElement) el.blur();
}

/**
 * Desktop: pinned side panels are docked open; unpinned ones shrink to a rail and open on
 * hover / focus-within (CSS). Mobile: fold buttons collapse a stacked panel to its header bar.
 */
export function mountPanels(ui: Store<UiPrefs>, app: Store<AppState>): void {
  const root = $('#app');

  const sides = (['left', 'right'] as const).map((side) => {
    const keys = KEYS[side];
    const slot = $(`#slot-${side}`);
    const pin = $(`#pin-${side}`);
    const fold = $(`#fold-${side}`);
    const foldAction = $('.fold-action', fold);

    pin.addEventListener('click', () => {
      const pinned = !ui.get()[keys.pin];
      ui.set({ [keys.pin]: pinned });
      if (!pinned) {
        // unpinning collapses right away instead of waiting for the pointer to leave
        app.set({ [keys.suppress]: true });
        blurActive();
      }
    });

    fold.addEventListener('click', () => {
      ui.set({ [keys.fold]: !ui.get()[keys.fold] });
    });

    slot.addEventListener('mouseleave', () => {
      if (app.get()[keys.suppress]) app.set({ [keys.suppress]: false });
      if (ui.get()[keys.pin]) return;
      // drop focus held inside (e.g. a just-clicked color) so the panel can close
      if (slot.contains(document.activeElement)) blurActive();
    });

    // focus arriving inside a collapsed slot (keyboard on the rail) is a request to open it
    slot.addEventListener('focusin', () => {
      if (app.get()[keys.suppress]) app.set({ [keys.suppress]: false });
    });

    return { side, keys, slot, pin, fold, foldAction };
  });

  const render = (): void => {
    const prefs = ui.get();
    const state = app.get();
    for (const { side, keys, slot, pin, fold, foldAction } of sides) {
      const pinned = prefs[keys.pin];
      const folded = prefs[keys.fold];
      setVar(root, keys.widthVar, pinned ? PINNED_W[side] : RAIL_W);
      toggleClass(slot, 'is-collapsed', !pinned);
      toggleClass(slot, 'is-suppressed', !pinned && state[keys.suppress]);
      toggleClass(slot, 'is-folded', folded);
      const label = pinned ? keys.pinLabel[0] : keys.pinLabel[1];
      setAttr(pin, 'aria-pressed', String(pinned));
      setAttr(pin, 'aria-label', label);
      setAttr(pin, 'title', label);
      setAttr(fold, 'aria-expanded', String(!folded));
      setText(foldAction, `${folded ? 'Show' : 'Hide'} ${keys.foldAction}`);
    }
    toggleClass(root, 'left-collapsed', !prefs.pinLeft);
    toggleClass(root, 'left-folded', prefs.foldLeft);
    toggleClass(root, 'desc-peek', state.peekType !== null);
  };

  ui.subscribe(render);
  app.subscribe(render);
  render();
}
