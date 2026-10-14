import { NOISE_TYPES } from '../noise/catalog';
import type { NoiseId, Settings, SoundOptions } from '../types';
import {
  DEFAULT_SETTINGS,
  OPTION_DEFAULTS,
  OPTION_KEYS,
  OPTION_LIMITS,
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
