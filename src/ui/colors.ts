import { getNoise } from '../noise/catalog';
import type { Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { $, setAttr, setText, setVar } from './dom';

/** Color chips: selection, the runtime accent, the selection line and the description. */
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

  const render = (): void => {
    const current = getNoise(settings.get().type);
    for (const b of buttons) setAttr(b.el, 'aria-pressed', String(b.id === current.id));
    setVar(root, '--accent', current.color);
    setText(selName, `${current.name} noise`);
    setText(selSlope, current.slope);
    setText(desc, current.desc);
  };

  settings.subscribe(render);
  render();
}
