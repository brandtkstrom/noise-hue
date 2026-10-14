import { describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../state/defaults';
import { optionsOf, volumeGain } from '../state/mappings';
import { createStore } from '../state/store';
import type { Settings } from '../types';
import { bindEngine, syncEngine, type SyncPort } from './engine-sync';

function stub(playing = true) {
  return {
    playing,
    switchTo: vi.fn<SyncPort['switchTo']>(),
    regenerate: vi.fn<SyncPort['regenerate']>(),
    applyOptions: vi.fn<SyncPort['applyOptions']>(),
    setLevel: vi.fn<SyncPort['setLevel']>(),
  } satisfies SyncPort;
}

const base: Settings = { ...DEFAULT_SETTINGS };
const withPatch = (p: Partial<Settings>, from: Settings = base): Settings => ({ ...from, ...p });

describe('syncEngine', () => {
  it('type change while playing switches to the new color with current options', () => {
    const e = stub(true);
    const next = withPatch({ type: 'pink' });
    syncEngine(e, next, base);
    expect(e.switchTo).toHaveBeenCalledWith('pink', optionsOf(next));
    expect(e.applyOptions).not.toHaveBeenCalled();
    expect(e.setLevel).not.toHaveBeenCalled();
  });

  it('type change while paused does not switch', () => {
    const e = stub(false);
    syncEngine(e, withPatch({ type: 'brown' }), base);
    expect(e.switchTo).not.toHaveBeenCalled();
  });

  it('type change supersedes a pending regenerate of the previous color', () => {
    // a brown-corner drag schedules regenerate('brown'); picking pink within the debounce
    // must replace it, or the stale timer would crossfade back to brown
    const e = stub(true);
    const next = withPatch({ type: 'pink' }, withPatch({ type: 'brown' }));
    syncEngine(e, next, withPatch({ type: 'brown' }));
    expect(e.regenerate).toHaveBeenCalledWith('pink', optionsOf(next));
  });

  it('a color-specific option change regenerates (debounced in the engine)', () => {
    const prev = withPatch({ type: 'brown' });
    const next = withPatch({ brownCorner: 80 }, prev);
    const e = stub(true);
    syncEngine(e, next, prev);
    expect(e.regenerate).toHaveBeenCalledWith('brown', optionsOf(next));
    expect(e.applyOptions).not.toHaveBeenCalled();
    expect(e.switchTo).not.toHaveBeenCalled();
  });

  it("another color's option change does nothing", () => {
    const e = stub(true);
    syncEngine(e, withPatch({ orangeQ: 10 }), base); // type is white
    expect(e.regenerate).not.toHaveBeenCalled();
    expect(e.applyOptions).not.toHaveBeenCalled();
  });

  it('a shared option change applies options in place', () => {
    const e = stub(true);
    const next = withPatch({ tilt: 4, pan: -20 });
    syncEngine(e, next, base);
    expect(e.applyOptions).toHaveBeenCalledTimes(1);
    expect(e.applyOptions).toHaveBeenCalledWith(optionsOf(next));
    expect(e.regenerate).not.toHaveBeenCalled();
  });

  it('volume and mute changes set the level with a 50 ms ramp', () => {
    const e = stub(true);
    syncEngine(e, withPatch({ volume: 80 }), base);
    expect(e.setLevel).toHaveBeenLastCalledWith(volumeGain(80, false), 0.05);
    syncEngine(e, withPatch({ muted: true }), base);
    expect(e.setLevel).toHaveBeenLastCalledWith(0, 0.05);
    expect(e.applyOptions).not.toHaveBeenCalled();
  });

  it('a color + options change at once applies options and switches to the new color', () => {
    const e = stub(true);
    const next = withPatch({ type: 'green', greenCenter: 800, tilt: -2 });
    syncEngine(e, next, base);
    expect(e.applyOptions).toHaveBeenCalledWith(optionsOf(next));
    expect(e.switchTo).toHaveBeenCalledWith('green', optionsOf(next));
    expect(e.regenerate).not.toHaveBeenCalledWith('white', expect.anything());
  });

  it('no relevant change makes no calls', () => {
    const e = stub(true);
    syncEngine(e, { ...base }, base);
    for (const fn of [e.switchTo, e.regenerate, e.applyOptions, e.setLevel]) {
      expect(fn).not.toHaveBeenCalled();
    }
  });
});

describe('bindEngine', () => {
  it('forwards store changes until unsubscribed', () => {
    const settings = createStore<Settings>({ ...base });
    const e = stub(true);
    const off = bindEngine(settings, e);
    settings.set({ volume: 70 });
    expect(e.setLevel).toHaveBeenCalledWith(volumeGain(70, false), 0.05);
    off();
    settings.set({ volume: 20 });
    expect(e.setLevel).toHaveBeenCalledTimes(1);
  });
});
