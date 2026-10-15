import { getNoise } from '../noise/catalog';
import type { Store } from '../state/store';
import type { Settings } from '../types';

/** Tile color of the mark, the same static value as `public/favicon.svg`. */
const TILE = '#0e1116';

/** The 32×32 mark of `public/favicon.svg`, as a data URL with the given dot color. */
function iconHref(dot: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
    `<rect width="32" height="32" rx="7" fill="${TILE}"/>` +
    `<circle cx="16" cy="16" r="9" fill="${dot}"/>` +
    '</svg>';
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * Tab icon: the title dot, one level up. `public/favicon.svg` (white) is the pre-JS
 * default; from mount on the SVG icon follows the selected noise color.
 */
export function mountFavicon(settings: Store<Settings>): void {
  let applied: string | null = null;

  const render = (): void => {
    const dot = getNoise(settings.get().type).color;
    if (dot === applied) return; // color untouched: sliders etc. must not churn the icon
    applied = dot;

    const link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/svg+xml';
    link.href = iconHref(dot);

    // a fresh element instead of an href mutation: some browsers only repaint the
    // tab icon when a new link element is added
    for (const old of document.head.querySelectorAll<HTMLLinkElement>(
      'link[rel="icon"][type="image/svg+xml"]',
    )) {
      old.remove();
    }
    document.head.append(link);
  };

  settings.subscribe(render);
  render();
}
