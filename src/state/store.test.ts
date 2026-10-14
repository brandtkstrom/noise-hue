import { describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

describe('store', () => {
  it('notifies subscribers with (next, prev)', () => {
    const s = createStore({ a: 1, b: 'x' });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ a: 2 });
    expect(fn).toHaveBeenCalledWith({ a: 2, b: 'x' }, { a: 1, b: 'x' });
    expect(s.get()).toEqual({ a: 2, b: 'x' });
  });

  it('does not notify when nothing changed', () => {
    const s = createStore({ a: 1 });
    const fn = vi.fn();
    s.subscribe(fn);
    s.set({ a: 1 });
    s.set({});
    expect(fn).not.toHaveBeenCalled();
  });

  it('unsubscribe stops calls', () => {
    const s = createStore({ a: 1 });
    const fn = vi.fn();
    const off = s.subscribe(fn);
    off();
    s.set({ a: 2 });
    expect(fn).not.toHaveBeenCalled();
  });
});
