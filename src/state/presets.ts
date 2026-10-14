import type { NoiseId, Preset, Settings, SoundOptions } from '../types';
import { MAX_PRESET_NAME, MAX_PRESETS, OPTION_KEYS } from './defaults';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "<colorName> N" with the smallest unused N >= 1. */
export function nextPresetName(list: Preset[], colorName: string): string {
  const re = new RegExp(`^${escapeRegExp(colorName)} (\\d+)$`);
  const used = new Set<number>();
  for (const p of list) {
    const m = re.exec(p.name);
    if (m) used.add(Number(m[1]));
  }
  let n = 1;
  while (used.has(n)) n++;
  return `${colorName} ${n}`;
}

export function normalizeName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= MAX_PRESET_NAME ? name : null;
}

export function addPreset(
  list: Preset[],
  p: Omit<Preset, 'id'>,
  makeId: () => string,
): Preset[] | null {
  if (list.length >= MAX_PRESETS) return null;
  const name = normalizeName(p.name);
  if (name === null) return null;
  return [...list, { id: makeId(), name, type: p.type, options: { ...p.options } }];
}

export function removePreset(list: Preset[], id: string): Preset[] {
  return list.filter((p) => p.id !== id);
}

export function optionsOf(s: Settings): SoundOptions {
  const out = {} as SoundOptions;
  for (const k of OPTION_KEYS) out[k] = s[k];
  return out;
}

export function findActivePreset(list: Preset[], type: NoiseId, o: SoundOptions): string | null {
  const hit = list.find((p) => p.type === type && OPTION_KEYS.every((k) => p.options[k] === o[k]));
  return hit ? hit.id : null;
}
