import { getNoise } from '../noise/catalog';
import { MAX_PRESETS } from '../state/defaults';
import {
  addPreset,
  findActivePreset,
  nextPresetName,
  optionsOf,
  removePreset,
} from '../state/presets';
import type { Store } from '../state/store';
import type { Preset, Settings } from '../types';
import { $, setAttr, setText, setVar } from './dom';

let fallbackSeq = 0;

/** `crypto.randomUUID` when available (secure contexts), else a timestamp + counter. */
export function defaultMakeId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackSeq += 1;
  return `p${Date.now().toString(36)}-${fallbackSeq.toString(36)}`;
}

interface Chip {
  preset: Preset;
  root: HTMLElement;
  apply: HTMLButtonElement;
  dot: HTMLElement;
  name: HTMLElement;
  del: HTMLButtonElement;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = cls;
  return node;
}

/**
 * Presets row: chips (apply + delete) rendered into `#presets`, and the "+ Save" inline-name flow.
 * Presets hold type + sound options only; volume and mute are never saved or applied.
 */
export function mountPresets(
  settings: Store<Settings>,
  presets: Store<{ list: Preset[] }>,
  save: (list: Preset[]) => void,
  makeId: () => string = defaultMakeId,
): void {
  const container = $('#presets');
  const saveBtn = $('#preset-save') as HTMLButtonElement;
  const input = $('#preset-name') as HTMLInputElement;
  const chips = new Map<string, Chip>();

  const commitList = (next: Preset[]): void => {
    presets.set({ list: next });
    save(next);
  };

  const remove = (chip: Chip): void => {
    const list = presets.get().list;
    const i = list.findIndex((p) => p.id === chip.preset.id);
    const neighbour = list[i + 1] ?? list[i - 1];
    commitList(removePreset(list, chip.preset.id));
    // keep keyboard focus in the row
    const target = neighbour ? chips.get(neighbour.id)?.apply : undefined;
    (target ?? saveBtn).focus();
  };

  const createChip = (preset: Preset): Chip => {
    const root = el('div', 'preset-chip');
    const apply = el('button', 'preset-apply');
    apply.type = 'button';
    const dot = el('span', 'preset-dot');
    dot.setAttribute('aria-hidden', 'true');
    const name = el('span', 'preset-name');
    apply.append(dot, name);
    const del = el('button', 'preset-del');
    del.type = 'button';
    del.textContent = '×';
    root.append(apply, del);
    const chip: Chip = { preset, root, apply, dot, name, del };
    apply.addEventListener('click', () => {
      // one store update: type + every option (crossfade happens downstream); never volume/mute
      const p = chip.preset;
      settings.set({ type: p.type, ...p.options });
    });
    del.addEventListener('click', () => remove(chip));
    return chip;
  };

  const render = (): void => {
    const { list } = presets.get();
    const s = settings.get();
    const active = findActivePreset(list, s.type, optionsOf(s));
    const live = new Set(list.map((p) => p.id));

    for (const [id, chip] of chips) {
      if (!live.has(id)) {
        chip.root.remove();
        chips.delete(id);
      }
    }
    list.forEach((preset, i) => {
      let chip = chips.get(preset.id);
      if (!chip) {
        chip = createChip(preset);
        chips.set(preset.id, chip);
      }
      chip.preset = preset;
      setText(chip.name, preset.name);
      setAttr(chip.apply, 'title', preset.name);
      setVar(chip.dot, '--c', getNoise(preset.type).color);
      setAttr(chip.apply, 'aria-pressed', String(preset.id === active));
      setAttr(chip.del, 'aria-label', `Delete preset ${preset.name}`);
      setAttr(chip.del, 'title', `Delete preset ${preset.name}`);
      const at = container.children[i];
      if (at !== chip.root) container.insertBefore(chip.root, at ?? null);
    });

    const full = list.length >= MAX_PRESETS;
    setAttr(saveBtn, 'disabled', full ? '' : null);
    setAttr(saveBtn, 'title', full ? `Preset limit reached (${MAX_PRESETS})` : null);
  };

  // ── save flow: "+ Save" swaps to an inline name input ──
  let editing = false;

  const openEditor = (): void => {
    if (saveBtn.disabled) return;
    const { list } = presets.get();
    editing = true;
    input.value = nextPresetName(list, getNoise(settings.get().type).name);
    input.hidden = false;
    saveBtn.hidden = true;
    input.focus();
    input.select();
  };

  /** Hides the input; `refocus` moves focus back to the row (not on blur, where the user moved it). */
  const closeEditor = (refocus: boolean): void => {
    if (!editing) return;
    editing = false;
    input.hidden = true;
    saveBtn.hidden = false;
    if (!refocus) return;
    if (!saveBtn.disabled) saveBtn.focus();
    else [...chips.values()].pop()?.apply.focus();
  };

  const commitEditor = (): void => {
    if (!editing) return;
    const s = settings.get();
    const next = addPreset(
      presets.get().list,
      { name: input.value, type: s.type, options: optionsOf(s) },
      makeId,
    );
    if (next) commitList(next);
    closeEditor(true);
  };

  saveBtn.addEventListener('click', openEditor);
  input.addEventListener('keydown', (e) => {
    // Enter/Escape while composing (IME) confirm or cancel the composition, not the editor
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      commitEditor();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeEditor(true);
    }
  });
  input.addEventListener('blur', () => closeEditor(false));

  presets.subscribe(render);
  settings.subscribe(render);
  render();
}
