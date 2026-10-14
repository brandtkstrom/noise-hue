// Live Web Audio engine (spec §5). Receives gains; never computes volume curves.
import type { NoiseId, SoundOptions } from '../types';
import { colorSignature, makeNoiseChannel } from './generators';
import { tiltGains, waveParams, widthGains } from './params';

export type ContextFactory = () => AudioContext;

type FadeResult = 'done' | 'cancelled';

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
  timerGain: GainNode;
  panner: StereoPannerNode | null;
  analyser: AnalyserNode;
  wave: Float32Array<ArrayBuffer>;
  freq: Float32Array<ArrayBuffer>;
}

const BUFFER_SECONDS = 8;
const CROSSFADE = 0.3;
const STOP_DELAY_MS = 500;
const REGEN_DEBOUNCE_MS = 250;
const WAVE_WINDOW = 2048;
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
  private fadeTimer: ReturnType<typeof setTimeout> | null = null;
  private fadeResolve: ((r: FadeResult) => void) | null = null;
  private bands: number[] | null = null;

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
    this.abortFade();
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
    this.abortFade(false);
    if (this.regenTimer !== null) {
      clearTimeout(this.regenTimer);
      this.regenTimer = null;
    }
    if (this.stopTimer !== null) clearTimeout(this.stopTimer);
    this.stopTimer = setTimeout(() => {
      this.stopTimer = null;
      this.stopAllVoices();
      // master is silent now, so restoring the timer gain cannot be heard
      this.resetTimerGain(0.01);
      this.bands = null;
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

  /** Time-domain samples decimated from the first 2048. */
  readWaveform(points: number): number[] | null {
    const g = this.graph;
    if (!g || !this.voice || points < 1) return null;
    g.analyser.getFloatTimeDomainData(g.wave);
    const step = Math.max(1, Math.floor(WAVE_WINDOW / points));
    const pts: number[] = [];
    for (let i = 0; i < points; i++) pts.push(g.wave[i * step] ?? 0);
    return pts;
  }

  /** Smoothed average power per band in dB (−120 for empty bands). */
  measureBands(bands: readonly { lo: number; hi: number }[]): number[] | null {
    const g = this.graph;
    if (!g || !this.voice) return null;
    g.analyser.getFloatFrequencyData(g.freq);
    const binHz = g.ctx.sampleRate / g.analyser.fftSize;
    const out: number[] = [];
    for (const band of bands) {
      const lo = Math.max(1, Math.floor(band.lo / binHz));
      const hi = Math.max(lo + 1, Math.ceil(band.hi / binHz));
      let sum = 0;
      let n = 0;
      for (let k = lo; k < hi && k < g.freq.length; k++) {
        sum += Math.pow(10, g.freq[k]! / 10);
        n++;
      }
      out.push(n && sum > 0 ? 10 * Math.log10(sum / n) : -120);
    }
    const prev = this.bands;
    if (!prev || prev.length !== out.length) this.bands = out;
    else for (let j = 0; j < out.length; j++) prev[j] = prev[j]! * 0.8 + out[j]! * 0.2;
    return this.bands ? [...this.bands] : null;
  }

  /** Linear fade of the timer gain to 0; resolves 'done' (caller then pauses). */
  fadeOut(seconds: number): Promise<FadeResult> {
    this.abortFade(false);
    const g = this.graph;
    if (!g || !this.isPlaying) return Promise.resolve('done');
    const p = g.timerGain.gain;
    const now = g.ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.linearRampToValueAtTime(0, now + seconds);
    return new Promise<FadeResult>((resolve) => {
      this.fadeResolve = resolve;
      this.fadeTimer = setTimeout(() => {
        this.fadeTimer = null;
        this.fadeResolve = null;
        resolve('done');
      }, seconds * 1000);
    });
  }

  /** Abandons a running fadeOut (it resolves 'cancelled') and restores the timer gain to 1. */
  cancelFade(): void {
    this.abortFade(true);
  }

  dispose(): void {
    for (const t of [this.stopTimer, this.regenTimer]) if (t !== null) clearTimeout(t);
    this.stopTimer = null;
    this.regenTimer = null;
    this.abortFade(false);
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
    this.bands = null;
  }

  // ---- internals ----

  private ensureGraph(o: SoundOptions): Graph {
    if (this.graph) return this.graph;
    const ctx = this.factory();
    const master = ctx.createGain();
    master.gain.value = 0;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 8192;
    analyser.smoothingTimeConstant = 0.85;
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
    // sleep-timer fade
    const timerGain = ctx.createGain();
    timerGain.gain.value = 1;
    merge.connect(lowCut);
    lowCut.connect(highCut);
    highCut.connect(tiltLow);
    tiltLow.connect(tiltHigh);
    tiltHigh.connect(waveGain);
    waveGain.connect(timerGain);
    let panner: StereoPannerNode | null = null;
    if (typeof ctx.createStereoPanner === 'function') {
      panner = ctx.createStereoPanner();
      panner.pan.value = o.pan / 100;
      timerGain.connect(panner);
      panner.connect(analyser);
    } else {
      timerGain.connect(analyser);
    }
    analyser.connect(ctx.destination);
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
      timerGain,
      panner,
      analyser,
      wave: new Float32Array(analyser.fftSize),
      freq: new Float32Array(analyser.frequencyBinCount),
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

  private resetTimerGain(tc: number): void {
    const g = this.graph;
    if (!g) return;
    const p = g.timerGain.gain;
    const now = g.ctx.currentTime;
    p.cancelScheduledValues(now);
    p.setTargetAtTime(1, now, tc);
  }

  /**
   * Resolves any pending fadeOut with 'cancelled'. With `restore`, the timer
   * gain returns to 1 now (play); otherwise it holds its current value until
   * the voice stops (pause), so pausing mid-fade never swells the level.
   */
  private abortFade(restore = true): void {
    if (this.fadeTimer !== null) {
      clearTimeout(this.fadeTimer);
      this.fadeTimer = null;
    }
    const resolve = this.fadeResolve;
    this.fadeResolve = null;
    resolve?.('cancelled');
    const g = this.graph;
    if (!g) return;
    if (restore) this.resetTimerGain(0.08);
    else {
      const p = g.timerGain.gain;
      const now = g.ctx.currentTime;
      p.cancelScheduledValues(now);
      p.setValueAtTime(p.value, now);
    }
  }
}
