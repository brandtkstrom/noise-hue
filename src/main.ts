import { bindEngine } from './app/engine-sync';
import { NoiseEngine } from './audio/engine';
import { createPersistence } from './state/persist';
import { createStore } from './state/store';
import type { Settings } from './types';
import { DEFAULT_APP_STATE, type AppState } from './ui/app-state';
import { mountColors } from './ui/colors';
import { $ } from './ui/dom';
import { mountSound } from './ui/sound';
import { mountTransport, type EnginePort } from './ui/transport';

const SAVE_DEBOUNCE_MS = 200;

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // e.g. blocked third-party storage throws on access
  }
}

/** Debounced writer with a flush for page hide / visibility hidden. */
function debounced<T>(write: (v: T) => void): { push(v: T): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { v: T } | null = null;
  const flush = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending) write(pending.v);
    pending = null;
  };
  return {
    push(v) {
      pending = { v };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    flush,
  };
}

/** Stand-in when Web Audio is missing: transport controls are disabled, so this is never driven. */
const silentEngine: EnginePort = {
  playing: false,
  play: () => Promise.resolve(),
  pause: () => {},
  setLevel: () => {},
};

function disableAudioControls(): void {
  $('#unsupported').hidden = false;
  for (const sel of ['#play', '#mute', '#vol']) {
    ($(sel) as HTMLButtonElement | HTMLInputElement).disabled = true;
  }
}

function main(): void {
  // ── state + persistence ──
  const persist = createPersistence(storageOrNull());
  const settings = createStore<Settings>(persist.loadSettings());
  const app = createStore<AppState>({ ...DEFAULT_APP_STATE });

  const saveSettings = debounced(persist.saveSettings);
  settings.subscribe((s) => saveSettings.push(s));
  addEventListener('pagehide', () => saveSettings.flush());
  // pagehide is unreliable on mobile (tab switched away, then killed): flush on hide too
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSettings.flush();
  });

  // ── audio ──
  const supported = NoiseEngine.isSupported();
  const engine = supported ? new NoiseEngine() : null;
  if (engine) bindEngine(settings, engine);
  else disableAudioControls();

  // ── UI ──
  mountColors(settings);
  mountSound(settings);
  mountTransport({ settings, app, engine: engine ?? silentEngine });
}

main();
