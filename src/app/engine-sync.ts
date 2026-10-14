import type { NoiseEngine } from '../audio/engine';
import { ALL_COLOR_OPTION_KEYS, colorKeysFor } from '../noise/catalog';
import { OPTION_KEYS } from '../state/defaults';
import { volumeGain } from '../state/mappings';
import { optionsOf } from '../state/presets';
import type { Store } from '../state/store';
import type { Settings } from '../types';

export type SyncPort = Pick<
  NoiseEngine,
  'switchTo' | 'regenerate' | 'applyOptions' | 'setLevel' | 'playing'
>;

const COLOR_KEYS = new Set<string>(ALL_COLOR_OPTION_KEYS);
/** Options the engine applies in place (filters, width, pan, waves). */
const SHARED_KEYS = OPTION_KEYS.filter((k) => !COLOR_KEYS.has(k));

/**
 * Maps one settings change to engine calls:
 * type (while playing) → switchTo; this color's own options → regenerate (debounced);
 * shared options → applyOptions; volume/mute → setLevel.
 */
export function syncEngine(engine: SyncPort, next: Settings, prev: Settings): void {
  const opts = optionsOf(next);
  if (SHARED_KEYS.some((k) => next[k] !== prev[k])) engine.applyOptions(opts);
  if (next.type !== prev.type) {
    // switchTo crossfades and builds the buffer for the new options in one go
    if (engine.playing) engine.switchTo(next.type, opts);
    // replaces any pending regenerate of the old color (engine.switchTo doesn't cancel it);
    // for the new color it is a no-op when it fires
    engine.regenerate(next.type, opts);
  } else if (colorKeysFor(next.type).some((k) => next[k] !== prev[k])) {
    engine.regenerate(next.type, opts);
  }
  if (next.volume !== prev.volume || next.muted !== prev.muted) {
    engine.setLevel(volumeGain(next.volume, next.muted), 0.05);
  }
}

export function bindEngine(settings: Store<Settings>, engine: SyncPort): () => void {
  return settings.subscribe((next, prev) => syncEngine(engine, next, prev));
}
