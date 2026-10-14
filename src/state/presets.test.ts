import { describe, expect, it } from 'vitest';
import type { Preset, Settings, SoundOptions } from '../types';
import { MAX_PRESETS, OPTION_DEFAULTS } from './defaults';
import {
  addPreset,
  findActivePreset,
  nextPresetName,
  normalizeName,
  optionsOf,
  removePreset,
} from './presets';

const mk = (
  name: string,
  id = name,
  type: Preset['type'] = 'pink',
  o: Partial<SoundOptions> = {},
): Preset => ({
  id,
  name,
  type,
  options: { ...OPTION_DEFAULTS, ...o },
});

describe('nextPresetName', () => {
  it('returns the smallest unused N', () => {
    expect(nextPresetName([mk('Pink 1'), mk('Pink 3')], 'Pink')).toBe('Pink 2');
  });
  it('starts at 1 and ignores other prefixes / non-integers', () => {
    expect(nextPresetName([], 'Pink')).toBe('Pink 1');
    expect(
      nextPresetName([mk('Brown 1'), mk('Pink 1.5'), mk('Pink x'), mk('Pink 1 b')], 'Pink'),
    ).toBe('Pink 1');
  });
});

describe('normalizeName', () => {
  it('trims and validates length', () => {
    expect(normalizeName('   ')).toBeNull();
    expect(normalizeName('  Rain  ')).toBe('Rain');
    expect(normalizeName('a'.repeat(32))).toBe('a'.repeat(32));
    expect(normalizeName('a'.repeat(33))).toBeNull();
    expect(normalizeName('a  b')).toBe('a  b');
  });
});

describe('addPreset / removePreset', () => {
  it('adds with generated id, copies options, does not mutate', () => {
    const list: Preset[] = [];
    const options = { ...OPTION_DEFAULTS };
    const out = addPreset(list, { name: ' Mine ', type: 'brown', options }, () => 'x1');
    expect(list).toHaveLength(0);
    expect(out).toHaveLength(1);
    expect(out![0]).toMatchObject({ id: 'x1', name: 'Mine', type: 'brown' });
    expect(out![0]!.options).not.toBe(options);
    expect(out![0]!.options).toEqual(options);
  });
  it('returns null at cap or for invalid name', () => {
    const full = Array.from({ length: MAX_PRESETS }, (_, i) => mk(`P ${i}`));
    expect(
      addPreset(full, { name: 'n', type: 'pink', options: OPTION_DEFAULTS }, () => 'z'),
    ).toBeNull();
    expect(
      addPreset([], { name: '  ', type: 'pink', options: OPTION_DEFAULTS }, () => 'z'),
    ).toBeNull();
  });
  it('removes by id without mutating', () => {
    const list = [mk('a'), mk('b')];
    expect(removePreset(list, 'a').map((p) => p.id)).toEqual(['b']);
    expect(list).toHaveLength(2);
    expect(removePreset(list, 'nope')).toHaveLength(2);
  });
});

describe('optionsOf', () => {
  it('excludes type, volume, muted', () => {
    const s: Settings = { ...OPTION_DEFAULTS, type: 'pink', volume: 50, muted: true, tilt: 3 };
    const o = optionsOf(s);
    expect(Object.keys(o).sort()).toEqual(Object.keys(OPTION_DEFAULTS).sort());
    expect(o.tilt).toBe(3);
    expect(o).not.toHaveProperty('type');
    expect(o).not.toHaveProperty('volume');
    expect(o).not.toHaveProperty('muted');
  });
});

describe('findActivePreset', () => {
  it('matches after add and returns null on any difference', () => {
    const options = { ...OPTION_DEFAULTS, tilt: 4 };
    const list = addPreset(
      [mk('other', 'o', 'white')],
      { name: 'm', type: 'pink', options },
      () => 'm1',
    )!;
    expect(findActivePreset(list, 'pink', options)).toBe('m1');
    expect(findActivePreset(list, 'pink', { ...options, orangeTune: 441 })).toBeNull();
    expect(findActivePreset(list, 'brown', options)).toBeNull();
  });
  it('returns the first match', () => {
    const list = [mk('a', 'a'), mk('b', 'b')];
    expect(findActivePreset(list, 'pink', OPTION_DEFAULTS)).toBe('a');
  });
});
