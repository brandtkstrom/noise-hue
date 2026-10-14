import { describe, expect, test } from 'vitest';
import {
  ALL_COLOR_OPTION_KEYS,
  COLORS_WITH_OPTIONS,
  COLOR_OPTION_KEYS,
  NOISE_TYPES,
  colorKeysFor,
  getNoise,
} from './catalog';

describe('noise catalog', () => {
  test('order matches display order', () => {
    expect(NOISE_TYPES.map((n) => n.id)).toEqual([
      'white',
      'grey',
      'brown',
      'pink',
      'green',
      'blue',
      'violet',
      'orange',
    ]);
  });

  test('getNoise returns catalog entries', () => {
    expect(getNoise('brown').color).toBe('#C49468');
    expect(getNoise('green').base).toBe('pink');
  });

  test('every entry has a description', () => {
    for (const n of NOISE_TYPES) expect(n.desc.length).toBeGreaterThan(0);
  });

  test('colorKeysFor lists options owned by a color', () => {
    expect(colorKeysFor('green')).toEqual(['greenCenter', 'greenWidth']);
    expect(colorKeysFor('blue')).toEqual([]);
    expect(colorKeysFor('orange')).toEqual(['orangeQ', 'orangeTune']);
    expect(COLOR_OPTION_KEYS.brownCorner).toBe('brown');
  });

  test('exposes all option keys and the colors that own options', () => {
    expect(ALL_COLOR_OPTION_KEYS).toEqual([
      'brownCorner',
      'greenCenter',
      'greenWidth',
      'greyStrength',
      'orangeQ',
      'orangeTune',
    ]);
    expect(COLORS_WITH_OPTIONS).toEqual(['brown', 'green', 'grey', 'orange']);
  });
});
