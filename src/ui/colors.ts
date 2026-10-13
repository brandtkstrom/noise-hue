import { getNoise } from '../noise/catalog';
import type { Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setText, setVar, toggleClass } from './dom';

/** Color panel: binds the 8 static color buttons; also owns accent, title dot, selection line and description. */
export function mountColors(settings: Store<Settings>, app: Store<AppState>): void {
  const root = $('#app');
  const titleDot = $('#title-dot');
  const selName = $('#sel-name');
  const selSlope = $('#sel-slope');
  const foldName = $('#fold-left-name');
  const desc = $('#desc');

  const buttons = [
    ...$('#color-list').querySelectorAll<HTMLElement>('button.color-btn[data-type]'),
  ].map((el) => {
    const id = el.dataset.type as NoiseId;
    getNoise(id); // fail fast on markup drift
    const peek = (): void => {
      if (app.get().peekType !== id) app.set({ peekType: id });
    };
    const unpeek = (): void => {
      if (app.get().peekType === id) app.set({ peekType: null });
    };
    // selecting a color only changes the color; playback is never started or stopped here
    el.addEventListener('click', () => {
      if (settings.get().type !== id) settings.set({ type: id });
    });
    el.addEventListener('mouseenter', peek);
    el.addEventListener('focus', peek);
    el.addEventListener('mouseleave', unpeek);
    el.addEventListener('blur', unpeek);
    return { id, el };
  });

  let dotType: NoiseId | null = null;
  let dotFlip: 'a' | 'b' | null = null;

  const render = (): void => {
    const { type } = settings.get();
    const { peekType } = app.get();
    const current = getNoise(type);

    for (const b of buttons) setAttr(b.el, 'aria-pressed', String(b.id === type));
    setVar(root, '--accent', current.color);
    setText(selName, `${current.name} noise`);
    setText(selSlope, current.slope);
    setText(foldName, current.name);
    setText(desc, getNoise(peekType ?? type).desc);
    toggleClass(root, 'desc-peek', peekType !== null);

    // flip between twin a/b classes on each color change so the bounce replays; none on first render
    if (dotType !== type) {
      if (dotType !== null) {
        dotFlip = dotFlip === 'a' ? 'b' : 'a';
        toggleClass(titleDot, 'dot-bounce-a', dotFlip === 'a');
        toggleClass(titleDot, 'dot-bounce-b', dotFlip === 'b');
      }
      dotType = type;
    }
  };

  settings.subscribe(render);
  app.subscribe(render);
  render();
}
