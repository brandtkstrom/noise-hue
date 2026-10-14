// Test-only minimal Web Audio fake (not imported by app code). Implements just
// what NoiseEngine uses; cast to AudioContext at the boundary.

export type ParamEvent =
  | { kind: 'setTargetAtTime'; value: number; time: number; tc: number }
  | { kind: 'setValueAtTime'; value: number; time: number }
  | { kind: 'linearRampToValueAtTime'; value: number; time: number }
  | { kind: 'cancelScheduledValues'; time: number };

export class FakeParam {
  value: number;
  events: ParamEvent[] = [];
  constructor(value = 0) {
    this.value = value;
  }
  setTargetAtTime(value: number, time: number, tc: number): this {
    this.events.push({ kind: 'setTargetAtTime', value, time, tc });
    this.value = value;
    return this;
  }
  setValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'setValueAtTime', value, time });
    this.value = value;
    return this;
  }
  linearRampToValueAtTime(value: number, time: number): this {
    this.events.push({ kind: 'linearRampToValueAtTime', value, time });
    this.value = value;
    return this;
  }
  cancelScheduledValues(time: number): this {
    this.events.push({ kind: 'cancelScheduledValues', time });
    return this;
  }
  /** Target of the most recent value-setting event (or the initial value). */
  get last(): number {
    for (let i = this.events.length - 1; i >= 0; i--) {
      const e = this.events[i]!;
      if (e.kind !== 'cancelScheduledValues') return e.value;
    }
    return this.value;
  }
}

export class FakeNode {
  readonly kind: string;
  connections: unknown[] = [];
  constructor(kind: string) {
    this.kind = kind;
  }
  connect(dest: unknown): unknown {
    this.connections.push(dest);
    return dest;
  }
  disconnect(): void {
    this.connections = [];
  }
}

export class FakeGain extends FakeNode {
  gain: FakeParam;
  constructor(initial = 1) {
    super('gain');
    this.gain = new FakeParam(initial);
  }
}

export class FakeBuffer {
  readonly numberOfChannels: number;
  readonly length: number;
  readonly sampleRate: number;
  private data: Float32Array[];
  constructor(channels: number, length: number, sampleRate: number) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.data = Array.from({ length: channels }, () => new Float32Array(length));
  }
  getChannelData(ch: number): Float32Array {
    return this.data[ch]!;
  }
}

export class FakeSource extends FakeNode {
  buffer: FakeBuffer | null = null;
  loop = false;
  started = false;
  stopCalls: (number | undefined)[] = [];
  onended: (() => void) | null = null;
  constructor() {
    super('source');
  }
  start(): void {
    this.started = true;
  }
  stop(when?: number): void {
    this.stopCalls.push(when);
  }
  get stopped(): boolean {
    return this.stopCalls.length > 0;
  }
}

export class FakeBiquad extends FakeNode {
  type = 'lowpass';
  frequency = new FakeParam(350);
  Q = new FakeParam(1);
  gain = new FakeParam(0);
  constructor() {
    super('biquad');
  }
}

export class FakeOscillator extends FakeNode {
  type = 'sine';
  frequency = new FakeParam(440);
  started = false;
  constructor() {
    super('oscillator');
  }
  start(): void {
    this.started = true;
  }
  stop(): void {}
}

export class FakePanner extends FakeNode {
  pan = new FakeParam(0);
  constructor() {
    super('panner');
  }
}

export class FakeAnalyser extends FakeNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  /** Value every time-domain sample reads as. */
  timeValue = 0;
  /** Value every frequency bin reads as (dB). */
  freqDb = -60;
  constructor() {
    super('analyser');
  }
  get frequencyBinCount(): number {
    return this.fftSize / 2;
  }
  getFloatTimeDomainData(out: Float32Array): void {
    out.fill(this.timeValue);
  }
  getFloatFrequencyData(out: Float32Array): void {
    out.fill(this.freqDb);
  }
}

export class FakeAudioContext {
  currentTime = 0;
  sampleRate: number;
  state: 'running' | 'suspended' | 'closed' | 'interrupted' = 'suspended';
  destination = new FakeNode('destination');
  resumeCalls = 0;
  suspendCalls = 0;
  closeCalls = 0;
  gains: FakeGain[] = [];
  sources: FakeSource[] = [];
  analysers: FakeAnalyser[] = [];
  panners: FakePanner[] = [];

  constructor(sampleRate = 4000) {
    this.sampleRate = sampleRate;
  }

  resume(): Promise<void> {
    this.resumeCalls++;
    this.state = 'running';
    return Promise.resolve();
  }
  suspend(): Promise<void> {
    this.suspendCalls++;
    this.state = 'suspended';
    return Promise.resolve();
  }
  close(): Promise<void> {
    this.closeCalls++;
    this.state = 'closed';
    return Promise.resolve();
  }
  createGain(): FakeGain {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createBufferSource(): FakeSource {
    const s = new FakeSource();
    this.sources.push(s);
    return s;
  }
  createBuffer(channels: number, length: number, sampleRate: number): FakeBuffer {
    return new FakeBuffer(channels, length, sampleRate);
  }
  createChannelSplitter(): FakeNode {
    return new FakeNode('splitter');
  }
  createChannelMerger(): FakeNode {
    return new FakeNode('merger');
  }
  createBiquadFilter(): FakeBiquad {
    return new FakeBiquad();
  }
  createOscillator(): FakeOscillator {
    return new FakeOscillator();
  }
  /** Set to undefined (via fakeFactory setup) to simulate no StereoPannerNode. */
  createStereoPanner: (() => FakePanner) | undefined = () => {
    const p = new FakePanner();
    this.panners.push(p);
    return p;
  };
  createAnalyser(): FakeAnalyser {
    const a = new FakeAnalyser();
    this.analysers.push(a);
    return a;
  }
}

/** A factory for NoiseEngine plus access to the contexts it created. */
export function fakeFactory(setup?: (c: FakeAudioContext) => void): {
  factory: () => AudioContext;
  contexts: FakeAudioContext[];
} {
  const contexts: FakeAudioContext[] = [];
  return {
    contexts,
    factory: () => {
      const c = new FakeAudioContext();
      setup?.(c);
      contexts.push(c);
      return c as unknown as AudioContext;
    },
  };
}
