import { SLEEP_MINUTES_LIMITS } from '../state/defaults';
import type { Store } from '../state/store';
import type { SleepTimer } from '../state/timer';
import type { UiPrefs } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setHidden, setText } from './dom';

export interface TimerPopover {
  /** Re-reads the timer: app.timerLabel, button label/pressed state, selected option. */
  sync(): void;
}

/**
 * Sleep-timer button + popover (Off/15/30/45/60/90/Custom). Esc closes and refocuses the
 * button; a click outside closes. Armed (set while paused) shows only aria-pressed (ruling R2);
 * the countdown text appears while running/fading.
 */
export function mountTimerPopover(deps: {
  ui: Store<UiPrefs>;
  app: Store<AppState>;
  timer: SleepTimer;
  /** Called before a new choice replaces a timer that is fading out. */
  onAbortFade: () => void;
}): TimerPopover {
  const { ui, app, timer, onAbortFade } = deps;
  const btn = $('#timer-btn');
  const label = $('#timer-label');
  const pop = $('#timer-popover');
  const wrap = btn.parentElement ?? pop;
  const form = $('#timer-custom-form') as HTMLFormElement;
  const custom = $('#timer-custom') as HTMLInputElement;
  const opts = [...pop.querySelectorAll<HTMLButtonElement>('.timer-opt')];

  /** Minutes of the timer the user last chose; null when off. */
  let chosen: number | null = null;

  const isOpen = (): boolean => !pop.hasAttribute('hidden');

  function open(): void {
    custom.value = String(ui.get().sleepMinutes);
    setAttr(custom, 'aria-invalid', null);
    setHidden(pop, false);
    setAttr(btn, 'aria-expanded', 'true');
    const current = opts.find((o) => o.getAttribute('aria-pressed') === 'true') ?? opts[0];
    current?.focus();
  }

  function close(refocus: boolean): void {
    if (!isOpen()) return;
    setHidden(pop, true);
    setAttr(btn, 'aria-expanded', 'false');
    if (refocus) btn.focus();
  }

  function choose(minutes: number | null): void {
    if (timer.phase() === 'fading') onAbortFade();
    timer.set(minutes, app.get().playing);
    chosen = minutes;
    if (minutes !== null) ui.set({ sleepMinutes: minutes });
    sync();
    close(true);
  }

  function sync(): void {
    const phase = timer.phase();
    if (phase === 'off') chosen = null;
    const text = timer.label();
    app.set({ timerLabel: text });
    setAttr(btn, 'aria-pressed', phase === 'off' ? 'false' : 'true');
    setText(label, text ?? '');
    setHidden(label, text === null);
    const name = text !== null ? `Sleep timer, ${text} left` : 'Sleep timer';
    setAttr(btn, 'aria-label', name);
    setAttr(btn, 'title', name);
    for (const o of opts) {
      const m = Number(o.dataset.minutes);
      setAttr(o, 'aria-pressed', (chosen === null ? m === 0 : m === chosen) ? 'true' : 'false');
    }
  }

  btn.addEventListener('click', () => (isOpen() ? close(false) : open()));

  for (const o of opts) {
    o.addEventListener('click', () => {
      const m = Number(o.dataset.minutes);
      choose(m > 0 ? m : null);
    });
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const m = Number(custom.value);
    const [lo, hi] = SLEEP_MINUTES_LIMITS;
    if (!Number.isInteger(m) || m < lo || m > hi) {
      setAttr(custom, 'aria-invalid', 'true');
      return;
    }
    choose(m);
  });

  pop.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    close(true);
  });
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen()) {
      e.preventDefault();
      close(true);
    }
  });

  document.addEventListener('click', (e) => {
    if (isOpen() && e.target instanceof Node && !wrap.contains(e.target)) close(false);
  });

  sync();
  return { sync };
}
