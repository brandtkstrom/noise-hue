import { NOISE_TYPES } from '../noise/catalog';
import type { NoiseId, Preset, Settings, SoundOptions, UiPrefs } from '../types';
import {
  DEFAULT_SETTINGS,
  DEFAULT_UI,
  MAX_PRESET_NAME,
  MAX_PRESETS,
  OPTION_DEFAULTS,
  OPTION_KEYS,
  OPTION_LIMITS,
  SLEEP_MINUTES_LIMITS,
  VOLUME_LIMITS,
} from './defaults';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

function num(v: unknown, [min, max]: [number, number], fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : fallback;
}

const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);

function noiseId(v: unknown): NoiseId | null {
  return typeof v === 'string' ? (NOISE_TYPES.find((n) => n.id === v)?.id ?? null) : null;
}

function sanitizeOptions(raw: unknown): SoundOptions {
  const r = isRec(raw) ? raw : {};
  const out = { ...OPTION_DEFAULTS };
  for (const k of OPTION_KEYS) {
    out[k] = num(r[k], OPTION_LIMITS[k], OPTION_DEFAULTS[k]);
  }
  return out;
}

export function sanitizeSettings(raw: unknown): Settings {
  const r = isRec(raw) ? raw : {};
  return {
    ...sanitizeOptions(r),
    type: noiseId(r.type) ?? DEFAULT_SETTINGS.type,
    volume: num(r.volume, VOLUME_LIMITS, DEFAULT_SETTINGS.volume),
    muted: bool(r.muted, DEFAULT_SETTINGS.muted),
  };
}

export function sanitizeUi(raw: unknown): UiPrefs {
  const r = isRec(raw) ? raw : {};
  return {
    pinLeft: bool(r.pinLeft, DEFAULT_UI.pinLeft),
    pinRight: bool(r.pinRight, DEFAULT_UI.pinRight),
    foldLeft: bool(r.foldLeft, DEFAULT_UI.foldLeft),
    foldRight: bool(r.foldRight, DEFAULT_UI.foldRight),
    sleepMinutes: num(r.sleepMinutes, SLEEP_MINUTES_LIMITS, DEFAULT_UI.sleepMinutes),
  };
}

function sanitizePreset(raw: unknown): Preset | null {
  if (!isRec(raw)) return null;
  const type = noiseId(raw.type);
  if (typeof raw.id !== 'string' || raw.id === '' || typeof raw.name !== 'string' || !type) {
    return null;
  }
  const name = raw.name.trim().slice(0, MAX_PRESET_NAME).trim();
  if (name === '') return null;
  return { id: raw.id, name, type, options: sanitizeOptions(raw.options) };
}

export function sanitizePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  for (const item of raw) {
    const p = sanitizePreset(item);
    if (p) out.push(p);
    if (out.length >= MAX_PRESETS) break;
  }
  return out;
}
