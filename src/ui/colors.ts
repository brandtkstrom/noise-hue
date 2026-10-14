import { getNoise, NOISE_TYPES } from '../noise/catalog';
import type { Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { $, setAttr, setText, setVar, toggleClass } from './dom';

/**
 * Color chips: selection, the runtime accent, the selection line and the description.
 * Every description is rendered into the same grid cell (only the active one is
 * visible), so the slot height never changes and the player never shifts.
 */
export function mountColors(settings: Store<Settings>): void {
  const root = $('#app');
  const selName = $('#sel-name');
  const selSlope = $('#sel-slope');
  const desc = $('#desc');

  const buttons = [
    ...$('#color-list').querySelectorAll<HTMLElement>('button.color-btn[data-type]'),
  ].map((el) => {
    const id = el.dataset.type as NoiseId;
    getNoise(id); // fail fast on markup drift
    // selecting a color only changes the color; playback is never started or stopped here
    el.addEventListener('click', () => {
      if (settings.get().type !== id) settings.set({ type: id });
    });
    return { id, el };
  });

  const descItems = NOISE_TYPES.map((noise) => {
    const el = document.createElement('p');
    el.className = 'desc-item';
    el.textContent = noise.desc;
    desc.append(el);
    return { id: noise.id, el };
  });

  const render = (): void => {
    const current = getNoise(settings.get().type);
    for (const b of buttons) setAttr(b.el, 'aria-pressed', String(b.id === current.id));
    for (const d of descItems) toggleClass(d.el, 'is-active', d.id === current.id);
    setVar(root, '--accent', current.color);
    setText(selName, `${current.name} noise`);
    setText(selSlope, current.slope);
  };

  settings.subscribe(render);
  render();
}
