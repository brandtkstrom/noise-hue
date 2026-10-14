import { getNoise, colorKeysFor } from '../noise/catalog';
import { DEFAULT_SETTINGS, OPTION_DEFAULTS } from '../state/defaults';
import * as m from '../state/mappings';
import type { Store } from '../state/store';
import type { NoiseId, Settings, SoundOptions } from '../types';
import { $, setAttr, setText, toggleClass } from './dom';

type Key = keyof SoundOptions;

interface SliderDef {
  key: Key;
  id: string;
  text: (v: number) => string;
  scale?: m.LogScale;
}

const SLIDERS: readonly SliderDef[] = [
  { key: 'tilt', id: 'tilt', text: m.tiltText },
  { key: 'lowCut', id: 'lowcut', text: m.lowCutText, scale: m.lowCut },
  { key: 'highCut', id: 'highcut', text: m.highCutText, scale: m.highCut },
  { key: 'pan', id: 'pan', text: m.panText },
  { key: 'width', id: 'width', text: m.widthText },
  { key: 'waveDepth', id: 'wavedepth', text: m.waveDepthText },
  { key: 'wavePeriod', id: 'waveperiod', text: m.wavePeriodText },
  { key: 'brownCorner', id: 'browncorner', text: m.brownCornerText, scale: m.brownCorner },
  { key: 'greenCenter', id: 'greencenter', text: m.greenCenterText, scale: m.greenCenter },
  { key: 'greenWidth', id: 'greenwidth', text: m.greenWidthText, scale: m.greenWidth },
  { key: 'greyStrength', id: 'greystrength', text: m.greyStrengthText },
  { key: 'orangeQ', id: 'orangeq', text: m.orangeQText },
  { key: 'orangeTune', id: 'orangetune', text: m.orangeTuneText },
];

/** Colors that have their own settings block (`#opts-<id>`). */
const COLOR_BLOCKS: readonly NoiseId[] = ['brown', 'green', 'grey', 'orange'];

const setHidden = (el: Element, hidden: boolean): void => setAttr(el, 'hidden', hidden ? '' : null);

const toValue = (def: SliderDef, pos: number): number => (def.scale ? def.scale.fromPos(pos) : pos);

/** Slider position -> stored value (pan snaps to center near the middle). */
const fromPos = (def: SliderDef, pos: number): number => {
  const v = toValue(def, pos);
  return def.key === 'pan' && Math.abs(v) <= 3 ? 0 : v;
};

interface Slider {
  def: SliderDef;
  input: HTMLInputElement;
  text: HTMLElement;
}

function syncSlider({ def, input, text }: Slider, s: Settings): void {
  const value = s[def.key];
  // leave the thumb alone while it already maps to the stored value (log rounding would make it jump)
  if (toValue(def, Number(input.value)) !== value) {
    const pos = String(def.scale ? def.scale.toPos(value) : value);
    if (input.value !== pos) input.value = pos;
  }
  const label = def.text(value);
  setText(text, label);
  setAttr(input, 'aria-valuetext', label);
}

/** Sound panel: option sliders, value text, changed dots, color-specific group, Reset. */
export function mountSound(settings: Store<Settings>): void {
  const sliders = SLIDERS.map((def): Slider => {
    const input = $(`#${def.id}`) as HTMLInputElement;
    const text = $(`#${def.id}-text`);
    const slider: Slider = { def, input, text };
    input.addEventListener('input', () => {
      settings.set({ [def.key]: fromPos(def, Number(input.value)) });
      // a snapped value may equal the stored one (no notify), so re-sync this thumb directly
      syncSlider(slider, settings.get());
    });
    input.addEventListener('dblclick', () => {
      settings.set({ [def.key]: OPTION_DEFAULTS[def.key] });
    });
    return slider;
  });

  $('#reset').addEventListener('click', () => {
    // keeps the selected color; resets volume, mute and every sound option
    settings.set({ ...OPTION_DEFAULTS, volume: DEFAULT_SETTINGS.volume, muted: false });
  });

  const grpColor = $('#grp-color');
  const grpColorTitle = $('#grp-color-title');
  const blocks = COLOR_BLOCKS.map((id) => ({ id, el: $(`#opts-${id}`) }));
  const dots = {
    char: $('#grp-color .changed-dot'),
    tone: $('#grp-tone .changed-dot'),
    space: $('#grp-space .changed-dot'),
    waves: $('#grp-waves .changed-dot'),
  };
  const wavePeriodField = $('#field-waveperiod');
  const summary = $('#fold-right-summary');

  const render = (s: Settings): void => {
    for (const slider of sliders) syncSlider(slider, s);

    const hasColorOpts = colorKeysFor(s.type).length > 0;
    setHidden(grpColor, !hasColorOpts);
    if (hasColorOpts) setText(grpColorTitle, `${getNoise(s.type).name} settings`);
    for (const b of blocks) setHidden(b.el, b.id !== s.type);

    const changes = m.changeSummary(s);
    setHidden(dots.char, !changes.char);
    setHidden(dots.tone, !changes.tone);
    setHidden(dots.space, !changes.space);
    setHidden(dots.waves, !changes.waves);

    toggleClass(wavePeriodField, 'is-dim', s.waveDepth === 0);
    setText(summary, changes.count === 0 ? 'Defaults' : `${changes.count} changed`);
  };

  settings.subscribe((s) => render(s));
  render(settings.get());
}
