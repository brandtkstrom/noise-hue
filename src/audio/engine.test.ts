import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OPTION_DEFAULTS } from '../state/defaults';
import type { SoundOptions } from '../types';
import { NoiseEngine } from './engine';
import { FakeAudioContext, FakeGain, fakeFactory } from './fake-context.test-util';

const O: SoundOptions = { ...OPTION_DEFAULTS };

function timerGainOf(c: FakeAudioContext): FakeGain {
  const panner = c.panners[0]!;
  const g = c.gains.find((n) => n.connections.includes(panner));
  if (!g) throw new Error('timerGain not found');
  return g;
}

function masterOf(c: FakeAudioContext): FakeGain {
  // source → voice gain → master
  const voiceGain = c.sources[0]!.connections[0] as FakeGain;
  return voiceGain.connections[0] as FakeGain;
}

describe('NoiseEngine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('isSupported false when no AudioContext on globalThis', () => {
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(NoiseEngine.isSupported()).toBe(false);
    vi.stubGlobal('AudioContext', FakeAudioContext);
    expect(NoiseEngine.isSupported()).toBe(true);
  });

  it('resumes on every play unless closed (suspend in flight, iOS interrupted)', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const c = contexts[0]!;
    expect(c.resumeCalls).toBe(1);
    // running (e.g. a suspend() still pending from the stop window): resume anyway
    e.pause();
    await e.play('white', O, 0.5);
    expect(c.resumeCalls).toBe(2);
    c.state = 'interrupted';
    e.pause();
    await e.play('white', O, 0.5);
    expect(c.resumeCalls).toBe(3);
    c.state = 'closed';
    e.pause();
    await e.play('white', O, 0.5);
    expect(c.resumeCalls).toBe(3);
  });

  it('creates the context lazily and resumes it on play', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    expect(contexts).toHaveLength(0);
    expect(e.playing).toBe(false);
    await e.play('white', O, 0.5);
    expect(contexts).toHaveLength(1);
    const c = contexts[0]!;
    expect(c.resumeCalls).toBe(1);
    expect(e.playing).toBe(true);
    const src = c.sources[0]!;
    expect(src.started).toBe(true);
    expect(src.loop).toBe(true);
    expect(src.buffer!.numberOfChannels).toBe(2);
    expect(src.buffer!.length).toBe(c.sampleRate * 8);
    // independent channels → different samples
    expect(src.buffer!.getChannelData(0)[100]).not.toBe(src.buffer!.getChannelData(1)[100]);
    const ev = masterOf(c).gain.events.at(-1)!;
    expect(ev).toMatchObject({ kind: 'setTargetAtTime', value: 0.5, tc: 0.08 });
    expect(c.analysers[0]!.fftSize).toBe(8192);
  });

  it('rapid switchTo keeps at most two live sources', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    e.switchTo('pink', O);
    e.switchTo('brown', O);
    e.switchTo('blue', O);
    const c = contexts[0]!;
    expect(c.sources).toHaveLength(4);
    const live = c.sources.filter((s) => !s.stopped);
    expect(live.length).toBeLessThanOrEqual(2);
    for (const s of c.sources.slice(0, -1)) expect(s.stopped).toBe(true);
    expect(c.sources.at(-1)!.stopped).toBe(false);
    // the immediate predecessor fades out over 0.3 s rather than cutting
    const prev = c.sources[2]!;
    expect(prev.stopCalls.at(-1)).toBeGreaterThan(c.currentTime);
    // older voices still mid-fade are cut now, so only two are ever audible
    for (const s of c.sources.slice(0, 2)) expect(s.stopCalls.at(-1)).toBeUndefined();
  });

  it('caches buffers by color signature', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    e.switchTo('pink', O);
    e.switchTo('white', O);
    const s = contexts[0]!.sources;
    expect(s[2]!.buffer).toBe(s[0]!.buffer);
    expect(s[1]!.buffer).not.toBe(s[0]!.buffer);
  });

  it('switchTo while paused only takes effect on the next play', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    e.pause();
    vi.advanceTimersByTime(500);
    e.switchTo('pink', O);
    const c = contexts[0]!;
    expect(c.sources).toHaveLength(1);
    await e.play('pink', O, 0.5);
    expect(c.sources).toHaveLength(2);
  });

  it('pause stops voice and suspends', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const c = contexts[0]!;
    e.pause();
    expect(e.playing).toBe(false);
    expect(masterOf(c).gain.events.at(-1)).toMatchObject({ value: 0, tc: 0.06 });
    vi.advanceTimersByTime(499);
    expect(c.sources[0]!.stopped).toBe(false);
    expect(c.suspendCalls).toBe(0);
    vi.advanceTimersByTime(1);
    expect(c.sources[0]!.stopped).toBe(true);
    expect(c.suspendCalls).toBe(1);
    expect(e.readWaveform(64)).toBeNull();
    expect(e.liveLevel()).toBe(0);
  });

  it('play during the pause tail keeps the voice and does not suspend', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    e.pause();
    vi.advanceTimersByTime(200);
    await e.play('white', O, 0.4);
    vi.advanceTimersByTime(1000);
    const c = contexts[0]!;
    expect(c.sources).toHaveLength(1);
    expect(c.sources[0]!.stopped).toBe(false);
    expect(c.suspendCalls).toBe(0);
  });

  it('fadeOut ramps timerGain to 0 and resolves done', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const c = contexts[0]!;
    c.currentTime = 10;
    const p = e.fadeOut(60);
    const tg = timerGainOf(c);
    expect(tg.gain.events.at(-1)).toEqual({ kind: 'linearRampToValueAtTime', value: 0, time: 70 });
    vi.advanceTimersByTime(60000);
    await expect(p).resolves.toBe('done');
  });

  it('fadeOut is cancelled by play', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const p = e.fadeOut(60);
    e.pause();
    await e.play('white', O, 0.5);
    await expect(p).resolves.toBe('cancelled');
    expect(timerGainOf(contexts[0]!).gain.last).toBe(1);
  });

  it('cancelFade resolves the pending fade cancelled and restores timerGain to 1', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const p = e.fadeOut(60);
    e.cancelFade();
    await expect(p).resolves.toBe('cancelled');
    expect(timerGainOf(contexts[0]!).gain.last).toBe(1);
    expect(e.playing).toBe(true);
    vi.advanceTimersByTime(60000);
  });

  it('cancelFade is a no-op without a graph', () => {
    const { factory } = fakeFactory();
    expect(() => new NoiseEngine(factory).cancelFade()).not.toThrow();
  });

  it('a second fadeOut cancels the first', async () => {
    const { factory } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const p1 = e.fadeOut(60);
    const p2 = e.fadeOut(5);
    await expect(p1).resolves.toBe('cancelled');
    vi.advanceTimersByTime(5000);
    await expect(p2).resolves.toBe('done');
  });

  it('regenerate is debounced 250 ms and a no-op when not playing', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    e.regenerate('brown', { ...O, brownCorner: 300 });
    vi.advanceTimersByTime(300);
    expect(contexts).toHaveLength(0);

    await e.play('brown', O, 0.5);
    const c = contexts[0]!;
    e.regenerate('brown', { ...O, brownCorner: 200 });
    e.regenerate('brown', { ...O, brownCorner: 300 });
    vi.advanceTimersByTime(249);
    expect(c.sources).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(c.sources).toHaveLength(2);
    expect(c.sources[0]!.stopped).toBe(true);

    e.pause();
    e.regenerate('brown', { ...O, brownCorner: 400 });
    vi.advanceTimersByTime(250);
    expect(c.sources).toHaveLength(2);
  });

  it('applyOptions sets width, tone, wave and pan params', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const c = contexts[0]!;
    e.applyOptions({ ...O, width: 100, tilt: 6, waveDepth: 50, wavePeriod: 10, pan: -40 });
    expect(c.panners[0]!.pan.last).toBeCloseTo(-0.4, 10);
    const lasts = c.gains.map((g) => g.gain.last);
    expect(lasts.filter((v) => Math.abs(v - Math.SQRT1_2) < 1e-9)).toHaveLength(3);
    expect(lasts.filter((v) => Math.abs(v + Math.SQRT1_2) < 1e-9)).toHaveLength(1);
    expect(lasts).toContain(0.25);
    expect(lasts).toContain(0.75);
  });

  it('works without StereoPannerNode', async () => {
    const { factory, contexts } = fakeFactory((c) => {
      c.createStereoPanner = undefined;
    });
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    e.applyOptions({ ...O, pan: 50 });
    const c = contexts[0]!;
    expect(c.panners).toHaveLength(0);
    expect(c.gains.some((g) => g.connections.includes(c.analysers[0]!))).toBe(true);
  });

  it('readWaveform decimates and liveLevel smooths RMS', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    expect(e.readWaveform(64)).toBeNull();
    await e.play('white', O, 0.5);
    const a = contexts[0]!.analysers[0]!;
    a.timeValue = 0.1; // rms −20 dB → target (−20+50)/36
    const pts = e.readWaveform(64)!;
    expect(pts).toHaveLength(64);
    expect(pts[0]).toBeCloseTo(0.1, 6);
    const target = 30 / 36;
    expect(e.liveLevel()).toBeCloseTo(target * 0.1, 6);
    e.readWaveform(64);
    expect(e.liveLevel()).toBeCloseTo(target * 0.1 * 0.9 + target * 0.1, 6);
  });

  it('measureBands averages bin power per band in dB, smoothed', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    const bands = [
      { lo: 100, hi: 200 },
      { lo: 1000, hi: 1500 },
    ];
    expect(e.measureBands(bands)).toBeNull();
    await e.play('white', O, 0.5);
    const a = contexts[0]!.analysers[0]!;
    a.freqDb = -30;
    const first = e.measureBands(bands)!;
    expect(first[0]).toBeCloseTo(-30, 6);
    expect(first[1]).toBeCloseTo(-30, 6);
    a.freqDb = -40;
    const second = e.measureBands(bands)!;
    expect(second[0]).toBeCloseTo(-30 * 0.8 + -40 * 0.2, 6);
  });

  it('setLevel ramps master only while playing', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    e.setLevel(0.3);
    await e.play('white', O, 0.5);
    const m = masterOf(contexts[0]!);
    e.setLevel(0.2, 0.05);
    expect(m.gain.events.at(-1)).toMatchObject({ kind: 'setTargetAtTime', value: 0.2, tc: 0.05 });
  });

  it('dispose closes the context and cancels a pending fade', async () => {
    const { factory, contexts } = fakeFactory();
    const e = new NoiseEngine(factory);
    await e.play('white', O, 0.5);
    const p = e.fadeOut(30);
    e.dispose();
    await expect(p).resolves.toBe('cancelled');
    expect(contexts[0]!.closeCalls).toBe(1);
    expect(e.playing).toBe(false);
  });
});
