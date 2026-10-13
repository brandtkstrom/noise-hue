import type { Preset, Settings, UiPrefs } from '../types';
import { DEFAULT_SETTINGS, DEFAULT_UI } from './defaults';
import { sanitizePresets, sanitizeSettings, sanitizeUi } from './validate';

const KEY_SETTINGS = 'noisehue:settings';
const KEY_UI = 'noisehue:ui';
const KEY_PRESETS = 'noisehue:presets';
const LEGACY_CONFIG = 'noise-app-config';
const LEGACY_PANES = 'noise-app-panes';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface Persistence {
  loadSettings(): Settings;
  saveSettings(s: Settings): void;
  loadUi(): UiPrefs;
  saveUi(u: UiPrefs): void;
  loadPresets(): Preset[];
  savePresets(p: Preset[]): void;
}

export function createPersistence(storage: StorageLike | null): Persistence {
  const read = (key: string): string | null => {
    try {
      return storage ? storage.getItem(key) : null;
    } catch {
      return null;
    }
  };
  const write = (key: string, value: unknown): void => {
    try {
      storage?.setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable: don't persist */
    }
  };
  const readJson = (key: string): unknown => {
    const text = read(key);
    if (text === null) return undefined;
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };

  return {
    loadSettings() {
      if (read(KEY_SETTINGS) !== null) return sanitizeSettings(readJson(KEY_SETTINGS));
      const legacy = readJson(LEGACY_CONFIG);
      if (legacy === undefined) return { ...DEFAULT_SETTINGS };
      const migrated = sanitizeSettings(legacy);
      write(KEY_SETTINGS, migrated);
      return migrated;
    },
    saveSettings: (s) => write(KEY_SETTINGS, s),
    loadUi() {
      if (read(KEY_UI) !== null) return sanitizeUi(readJson(KEY_UI));
      const legacy = readJson(LEGACY_PANES);
      if (!legacy || typeof legacy !== 'object') return { ...DEFAULT_UI };
      const l = legacy as Record<string, unknown>;
      const migrated = sanitizeUi({
        pinLeft: l.left,
        pinRight: l.right,
        foldLeft: l.foldLeft,
        foldRight: l.foldRight,
      });
      write(KEY_UI, migrated);
      return migrated;
    },
    saveUi: (u) => write(KEY_UI, u),
    loadPresets: () => sanitizePresets(readJson(KEY_PRESETS)),
    savePresets: (p) => write(KEY_PRESETS, p),
  };
}
