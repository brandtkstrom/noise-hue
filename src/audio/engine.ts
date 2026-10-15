// Live Web Audio engine (spec §5). Receives gains; never computes volume curves.
import type { NoiseId, SoundOptions } from '../types';
import { colorSignature, makeNoiseChannel } from './generators';
import { tiltGains, waveParams, widthGains } from './params';

export type ContextFactory = () => AudioContext;

interface Voice {
  src: AudioBufferSourceNode;
  g: GainNode;
  key: string;
}

interface Graph {
  ctx: AudioContext;
  master: GainNode;
  wAL: GainNode;
  wAR: GainNode;
  wBL: GainNode;
  wBR: GainNode;
  lowCut: BiquadFilterNode;
  highCut: BiquadFilterNode;
  tiltLow: BiquadFilterNode;
  tiltHigh: BiquadFilterNode;
  waveGain: GainNode;
  waveLfo: OscillatorNode;
  waveLfoGain: GainNode;
  panner: StereoPannerNode | null;
}

const BUFFER_SECONDS = 8;
const CROSSFADE = 0.3;
const STOP_DELAY_MS = 500;
const REGEN_DEBOUNCE_MS = 250;
/** Bounds memory when slider-driven regeneration creates many signatures. */
const MAX_CACHED_BUFFERS = 10;

type AudioContextCtor = new () => AudioContext;

function contextCtor(): AudioContextCtor | undefined {
  const g = globalThis as unknown as {
    AudioContext?: AudioContextCtor;
    webkitAudioContext?: AudioContextCtor;
  };
  return g.AudioContext ?? g.webkitAudioContext;
}

const defaultFactory: ContextFactory = () => {
  const AC = contextCtor();
  if (!AC) throw new Error('Web Audio is not supported');
  return new AC();
};

export class NoiseEngine {
  static isSupported(): boolean {
    return typeof contextCtor() === 'function';
  }

  private readonly factory: ContextFactory;
  private graph: Graph | null = null;
  private voice: Voice | null = null;
  /** The voice currently fading out after a switch (at most one). */
  private outgoing: Voice | null = null;
  private buffers = new Map<string, AudioBuffer>();
  private isPlaying = false;
  private stopTimer: ReturnType<typeof setTimeout> | null = null;
  private regenTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(factory: ContextFactory = defaultFactory) {
    this.factory = factory;
  }

  get playing(): boolean {
    return this.isPlaying;
  }

  play(id: NoiseId, o: SoundOptions, gain: number): Promise<void> {
    const g = this.ensureGraph(o);
    const { ctx } = g;
    // resume synchronously inside the user gesture; await at the end. Always resume (unless
    // closed): a suspend() may still be in flight, and iOS reports 'interrupted'.
    const resumed = ctx.state !== 'closed' ? ctx.resume() : Promise.resolve();
    if (this.stopTimer !== null) {
      clearTimeout(this.stopTimer);
      this.stopTimer = null;
    }
    this.applyOptions(o);
    if (!this.voice || this.voice.key !== colorSignature(id, o)) this.startVoice(id, o);
    this.setMaster(gain, 0.08);
    this.isPlaying = true;
    return resumed;
  }

  pause(): void {
    const g = this.graph;
    if (!g) return;
    this.isPlaying = false;
    this.setMaster(0, 0.06);
    if (this.regenTimer !== null) {
      clearTimeout(this.regenTimer);
      this.regenTimer = null;
    }
    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      this.stopAllVoices();
      void g.ctx.suspend();
    }, STOP_DELAY_MS);
  }

  switchTo(id: NoiseId, o: SoundOptions): void {
    if (!this.graph || !this.isPlaying) return;
    if (this.voice && this.voice.key === colorSignature(id, o)) return;
    this.startVoice(id, o);
  }

  regenerate(id: NoiseId, o: SoundOptions): void {
    if (this.regenTimer !== null) clearTimeout(this.regenTimer);
    this.regenTimer = setTimeout(() => {
      this.regenTimer = null;
      this.switchTo(id, o);
    }, REGEN_DEBOUNCE_MS);
  }

  setLevel(gain: number, rampSec = 0.05): void {
    if (!this.graph || !this.isPlaying) return;
    this.setMaster(gain, rampSec);
  }

  applyOptions(o: SoundOptions): void {
    const g = this.graph;
    if (!g) return;
    const t = g.ctx.currentTime;
    const k = 0.05;
    const { c, s } = widthGains(o.width);
    g.wAL.gain.setTargetAtTime(c, t, k);
    g.wAR.gain.setTargetAtTime(c, t, k);
    g.wBL.gain.setTargetAtTime(s, t, k);
    g.wBR.gain.setTargetAtTime(-s, t, k);
    g.lowCut.frequency.setTargetAtTime(o.lowCut, t, k);
    g.highCut.frequency.setTargetAtTime(o.highCut, t, k);
    const { lowDb, highDb } = tiltGains(o.tilt);
    g.tiltLow.gain.setTargetAtTime(lowDb, t, k);
    g.tiltHigh.gain.setTargetAtTime(highDb, t, k);
    const w = waveParams(o.waveDepth, o.wavePeriod);
    g.waveLfo.frequency.setTargetAtTime(w.lfoHz, t, 0.2);
    g.waveLfoGain.gain.setTargetAtTime(w.lfoGain, t, 0.2);
    g.waveGain.gain.setTargetAtTime(w.base, t, 0.2);
    if (g.panner) g.panner.pan.setTargetAtTime(o.pan / 100, t, 0.03);
  }

  dispose(): void {
    for (const t of [this.stopTimer, this.regenTimer]) if (t !== null) clearTimeout(t);
    this.stopTimer = null;
    this.regenTimer = null;
    this.isPlaying = false;
    this.stopAllVoices();
    if (this.graph) {
      try {
        this.graph.waveLfo.stop();
      } catch {
        // already stopped
      }
      void this.graph.ctx.close();
    }
    this.graph = null;
    this.buffers.clear();
  }

  // ---- internals ----

  private ensureGraph(o: SoundOptions): Graph {
    if (this.graph) return this.graph;
    const ctx = this.factory();
    const master = ctx.createGain();
    master.gain.value = 0;
    // stereo width: L = c·a + s·b, R = c·a − s·b (a, b = independent noise channels)
    const split = ctx.createChannelSplitter(2);
    const merge = ctx.createChannelMerger(2);
    const wAL = ctx.createGain();
    const wBL = ctx.createGain();
    const wAR = ctx.createGain();
    const wBR = ctx.createGain();
    master.connect(split);
    split.connect(wAL, 0);
    split.connect(wAR, 0);
    split.connect(wBL, 1);
    split.connect(wBR, 1);
    wAL.connect(merge, 0, 0);
    wBL.connect(merge, 0, 0);
    wAR.connect(merge, 0, 1);
    wBR.connect(merge, 0, 1);
    // tone
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.Q.value = 0.707;
    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.Q.value = 0.707;
    const tiltLow = ctx.createBiquadFilter();
    tiltLow.type = 'lowshelf';
    tiltLow.frequency.value = 800;
    const tiltHigh = ctx.createBiquadFilter();
    tiltHigh.type = 'highshelf';
    tiltHigh.frequency.value = 1250;
    // waves (slow volume swell)
    const waveGain = ctx.createGain();
    const waveLfo = ctx.createOscillator();
    waveLfo.type = 'sine';
    const waveLfoGain = ctx.createGain();
    waveLfoGain.gain.value = 0;
    waveLfo.connect(waveLfoGain);
    waveLfoGain.connect(waveGain.gain);
    waveLfo.start();
    merge.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(tiltLow);
    tiltLow.connect(tiltHigh);
    tiltHigh.connect(waveGain);
    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = o.pan / 100;
      waveGain.connect(panner);
      panner.connect(ctx.destination);
    } else {
      waveGain.connect(ctx.destination);
    }
    this.graph = {
      ctx,
      master,
      wAL,
      wAR,
      wBL,
      wBR,
      lowCut,
      highCut,
      tiltLow,
      tiltHigh,
      waveGain,
      waveLfo,
      waveLfoGain,
      panner,
    };
    this.applyOptions(o);
    return this.graph;
  }

  private bufferFor(ctx: AudioContext, id: NoiseId, o: SoundOptions, key: string): AudioBuffer {
    const hit = this.buffers.get(key);
    if (hit) {
      // refresh LRU position
      this.buffers.delete(key);
      this.buffers.set(key, hit);
      return hit;
    }
    const sr = ctx.sampleRate;
    const len = sr * BUFFER_SECONDS;
    const buf = ctx.createBuffer(2, len, sr);
    // independent channels: stereo width depends on a and b being uncorrelated
    for (let ch = 0; ch < 2; ch++) buf.getChannelData(ch).set(makeNoiseChannel(sr, len, id, o));
    this.buffers.set(key, buf);
    if (this.buffers.size > MAX_CACHED_BUFFERS) {
      const oldest = this.buffers.keys().next().value;
      if (oldest !== undefined) this.buffers.delete(oldest);
    }
    return buf;
  }

  private startVoice(id: NoiseId, o: SoundOptions): void {
    const g = this.graph;
    if (!g) return;
    const { ctx } = g;
    const now = ctx.currentTime;
    const key = colorSignature(id, o);
    const src = ctx.createBufferSource();
    const vg = ctx.createGain();
    src.buffer = this.bufferFor(ctx, id, o, key);
    src.loop = true;
    vg.gain.setValueAtTime(0, now);
    vg.gain.linearRampToValueAtTime(1, now + CROSSFADE);
    src.connect(vg);
    vg.connect(g.master);
    src.start();
    // anything still fading out is cut so at most two voices are audible
    if (this.outgoing) this.killVoice(this.outgoing);
    const old = this.voice;
    if (old) {
      old.g.gain.cancelScheduledValues(now);
      old.g.gain.setValueAtTime(old.g.gain.value, now);
      old.g.gain.linearRampToValueAtTime(0, now + CROSSFADE);
      this.safeStop(old.src, now + CROSSFADE + 0.05);
      old.src.onended = () => {
        old.g.disconnect();
        if (this.outgoing === old) this.outgoing = null;
      };
    }
    this.outgoing = old;
    this.voice = { src, g: vg, key };
  }

  private killVoice(v: Voice): void {
    this.safeStop(v.src);
    v.g.disconnect();
  }

  private stopAllVoices(): void {
    if (this.outgoing) this.killVoice(this.outgoing);
    if (this.voice) this.killVoice(this.voice);
    this.outgoing = null;
    this.voice = null;
  }

  private safeStop(src: AudioBufferSourceNode, when?: number): void {
    try {
      src.stop(when);
    } catch {
      // already stopped
    }
  }

  private setMaster(v: number, tc: number): void {
    const g = this.graph;
    if (!g) return;
    const p = g.master.gain;
    const now = g.ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(v, now, tc);
  }
}
