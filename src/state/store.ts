export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: (next: T, prev: T) => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<(next: T, prev: T) => void>();
  return {
    get: () => state,
    set(patch) {
      const keys = Object.keys(patch) as (keyof T)[];
      if (keys.every((k) => Object.is(state[k], patch[k]))) return;
      const prev = state;
      state = { ...state, ...patch };
      for (const fn of [...subs]) fn(state, prev);
    },
    subscribe(fn) {
      subs.add(fn);
      return () => void subs.delete(fn);
    },
  };
}
