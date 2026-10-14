import type { NoiseEngine } from '../audio/engine';
import { CONFIG } from '../config';
import {
  effectiveVolume,
  optionsOf,
  statusState,
  statusText,
  volumeGain,
  volumeShort,
  volumeText,
} from '../state/mappings';
import type { Store } from '../state/store';
import type { Settings } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setHidden, setText } from './dom';

export type EnginePort = Pick<NoiseEngine, 'play' | 'pause' | 'setLevel' | 'playing'>;

/**
 * Player: play/pause, status, volume and mute.
 * The engine level is not set here (main subscribes the engine to settings).
 */
export function mountTransport(deps: {
  settings: Store<Settings>;
  app: Store<AppState>;
  engine: EnginePort;
}): void {
  const { settings, app, engine } = deps;
  const playBtn = $('#play');
  const iconPlay = $('.icon-play', playBtn);
  const iconPause = $('.icon-pause', playBtn);
  const status = $('#status');
  const muteBtn = $('#mute');
  const iconMuted = $('.icon-vol-muted', muteBtn);
  const iconOn = $('.icon-vol-on', muteBtn);
  const vol = $('#vol') as HTMLInputElement;
  const readout = $('#vol-readout');
  const unsupported = $('#unsupported');

  let lastVolume = settings.get().volume > 0 ? settings.get().volume : CONFIG.defaultVolume;
  /** Bumped on every play/pause so a stale resume rejection can't pause a later session. */
  let session = 0;

  function play(): void {
    const s = settings.get();
    const mine = ++session;
    let resumed: Promise<void>;
    try {
      // must run synchronously inside the click (autoplay gesture requirement)
      resumed = engine.play(s.type, optionsOf(s), volumeGain(s.volume, s.muted));
    } catch {
      // the AudioContext constructor can throw despite isSupported() (sandbox, context limit)
      setHidden(unsupported, false);
      return;
    }
    // a context that refuses to resume stays silent: don't claim Playing
    resumed.catch(() => {
      if (mine === session && app.get().playing) pause();
    });
    app.set({ playing: true });
  }

  function pause(): void {
    session++;
    engine.pause();
    app.set({ playing: false });
  }

  playBtn.addEventListener('click', () => (app.get().playing ? pause() : play()));

  vol.addEventListener('input', () => {
    settings.set({ volume: Number(vol.value), muted: false });
  });

  muteBtn.addEventListener('click', () => {
    const s = settings.get();
    if (s.muted) settings.set({ muted: false });
    else if (s.volume === 0) settings.set({ volume: lastVolume });
    else settings.set({ muted: true });
  });

  function render(): void {
    const s = settings.get();
    const a = app.get();
    const eff = effectiveVolume(s);

    const label = a.playing ? 'Pause' : 'Play';
    setAttr(playBtn, 'aria-label', label);
    setAttr(playBtn, 'title', label);
    setHidden(iconPlay, a.playing);
    setHidden(iconPause, !a.playing);

    if (vol.value !== String(s.volume)) vol.value = String(s.volume);
    setAttr(vol, 'aria-valuetext', volumeText(s));
    setText(readout, volumeShort(s));
    const muteLabel = eff === 0 ? 'Unmute' : 'Mute';
    // pressed = silent (muted or volume 0), matching the Unmute label
    setAttr(muteBtn, 'aria-pressed', eff === 0 ? 'true' : 'false');
    setAttr(muteBtn, 'aria-label', muteLabel);
    setAttr(muteBtn, 'title', muteLabel);
    setHidden(iconMuted, eff !== 0);
    setHidden(iconOn, eff === 0);

    setText(status, statusText(a.playing, s));
    setAttr(status, 'data-state', statusState(a.playing, s));
  }

  settings.subscribe((next) => {
    if (next.volume > 0) lastVolume = next.volume;
    render();
  });
  app.subscribe(render);
  render();
}
