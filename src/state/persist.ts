import type { Settings } from '../types';
import { DEFAULT_SETTINGS } from './defaults';
import { sanitizeSettings } from './validate';

const KEY_SETTINGS = 'noisehue:settings';
const LEGACY_CONFIG = 'noise-app-config';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export interface Persistence {
  loadSettings(): Settings;
  saveSettings(s: Settings): void;
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
  };
}
