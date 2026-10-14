import { bindEngine } from './app/engine-sync';
import { NoiseEngine } from './audio/engine';
import { createPersistence } from './state/persist';
import { createStore } from './state/store';
import { createSleepTimer } from './state/timer';
import type { Preset, Settings, UiPrefs } from './types';
import { DEFAULT_APP_STATE, type AppState } from './ui/app-state';
import { mountColors } from './ui/colors';
import { $ } from './ui/dom';
import { mountImmersive } from './ui/immersive';
import { mountPanels } from './ui/panels';
import { mountPresets } from './ui/presets';
import { mountSound } from './ui/sound';
import { mountTransport, type EnginePort } from './ui/transport';
import { mountViz, type VizEngine } from './ui/viz';

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
const silentEngine: EnginePort & VizEngine = {
  playing: false,
  play: () => Promise.resolve(),
  pause: () => {},
  setLevel: () => {},
  fadeOut: () => Promise.resolve('done'),
  cancelFade: () => {},
  readWaveform: () => null,
  measureBands: () => null,
};

function disableAudioControls(): void {
  $('#unsupported').hidden = false;
  for (const sel of ['#play', '#timer-btn', '#mute', '#vol']) {
    ($(sel) as HTMLButtonElement | HTMLInputElement).disabled = true;
  }
}

function main(): void {
  // ── state + persistence ──
  const persist = createPersistence(storageOrNull());
  const settings = createStore<Settings>(persist.loadSettings());
  const ui = createStore<UiPrefs>(persist.loadUi());
  const presets = createStore<{ list: Preset[] }>({ list: persist.loadPresets() });
  const app = createStore<AppState>({ ...DEFAULT_APP_STATE });

  const saveSettings = debounced(persist.saveSettings);
  const saveUi = debounced(persist.saveUi);
  settings.subscribe((s) => saveSettings.push(s));
  ui.subscribe((u) => saveUi.push(u));
  const flushSaves = (): void => {
    saveSettings.flush();
    saveUi.flush();
  };
  addEventListener('pagehide', flushSaves);
  // pagehide is unreliable on mobile (tab switched away, then killed): flush on hide too
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushSaves();
  });

  // ── audio ──
  const supported = NoiseEngine.isSupported();
  const engine = supported ? new NoiseEngine() : null;
  if (engine) bindEngine(settings, engine);
  else disableAudioControls();

  // ── UI ──
  const timer = createSleepTimer(() => performance.now());
  mountPanels(ui, app);
  mountColors(settings, app);
  mountSound(settings);
  mountPresets(settings, presets, persist.savePresets);
  const transport = mountTransport({ settings, ui, app, engine: engine ?? silentEngine, timer });
  mountImmersive(settings, app);

  const mql =
    typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  const viz = mountViz({
    settings,
    app,
    engine: engine ?? silentEngine,
    reducedMotion: () => mql?.matches ?? false,
    onFrame: () => transport.tick(),
  });
  mql?.addEventListener('change', () => viz.refresh());

  // rAF stops in background tabs; the sleep timer must keep counting there
  setInterval(() => transport.tick(), 1000);
}

main();
