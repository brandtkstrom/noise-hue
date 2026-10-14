import { effectiveVolume } from '../state/mappings';
import type { Store } from '../state/store';
import type { Settings } from '../types';
import type { AppState } from './app-state';
import { $, setHidden, toggleClass } from './dom';

/** Keys that move focus or are modifiers; every other key while immersive exits. */
const PASS_KEYS = new Set(['Tab', 'Shift', 'Meta', 'Control', 'Alt']);

/**
 * Fullscreen button and immersive mode: panels and bar fade, any non-modifier key or a click
 * exits, leaving browser fullscreen exits. Browser fullscreen is best effort; immersive mode
 * works in-page on its own.
 */
export function mountImmersive(settings: Store<Settings>, app: Store<AppState>): void {
  const appEl = $('#app');
  const fsBtn = $('#fullscreen');
  const overlay = $('#exit-overlay');

  // on document, not the overlay: Tab may move focus off it and must not trap the user
  function onImmersiveKey(e: KeyboardEvent): void {
    if (PASS_KEYS.has(e.key)) return;
    e.preventDefault();
    exitImmersive();
  }

  function enterImmersive(): void {
    app.set({ immersive: true });
    document.addEventListener('keydown', onImmersiveKey);
    setHidden(overlay, false);
    overlay.focus({ preventScroll: true });
    try {
      const root = document.documentElement;
      if (typeof root.requestFullscreen === 'function' && !document.fullscreenElement) {
        root.requestFullscreen().catch(() => {});
      }
    } catch {
      // best effort: immersive mode works without browser fullscreen
    }
  }

  function exitImmersive(): void {
    if (!app.get().immersive) return;
    app.set({ immersive: false });
    document.removeEventListener('keydown', onImmersiveKey);
    setHidden(overlay, true);
    try {
      if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
        document.exitFullscreen().catch(() => {});
      }
    } catch {
      // ignore
    }
    fsBtn.focus({ preventScroll: true });
  }

  fsBtn.addEventListener('click', enterImmersive);
  overlay.addEventListener('click', exitImmersive);
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) exitImmersive();
  });

  const render = (): void => {
    const s = settings.get();
    const a = app.get();
    toggleClass(appEl, 'is-immersive', a.immersive);
    toggleClass(appEl, 'is-audible', a.immersive && a.playing && effectiveVolume(s) > 0);
  };

  settings.subscribe(render);
  app.subscribe(render);
  render();
}
