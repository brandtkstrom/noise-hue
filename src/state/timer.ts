export type TimerPhase = 'off' | 'armed' | 'running' | 'fading';

export interface TimerTick {
  startFade?: number;
  finished?: boolean;
}

export interface SleepTimer {
  set(minutes: number | null, playing: boolean): void;
  onPlay(): void;
  onPause(): void;
  tick(): TimerTick;
  phase(): TimerPhase;
  remainingMs(): number;
  label(): string | null;
}

/** Fade length in seconds: last 60 s, or 20 % of the duration if under 5 min. */
export function fadeSecondsFor(minutes: number): number {
  return minutes < 5 ? minutes * 60 * 0.2 : 60;
}

export function formatRemaining(ms: number): string {
  if (ms < 60_000) return '<1m';
  return `${Math.ceil(ms / 60_000)}m`;
}

export function createSleepTimer(now: () => number): SleepTimer {
  let phase: TimerPhase = 'off';
  let remaining = 0;
  let fadeMs = 0;
  let last = 0;

  const counting = () => phase === 'running' || phase === 'fading';

  function sync(): void {
    if (counting()) {
      const t = now();
      remaining = Math.max(0, remaining - (t - last));
      last = t;
    }
  }

  function reset(): void {
    phase = 'off';
    remaining = 0;
    fadeMs = 0;
  }

  return {
    set(minutes, playing) {
      if (minutes === null) {
        reset();
        return;
      }
      remaining = minutes * 60_000;
      fadeMs = fadeSecondsFor(minutes) * 1000;
      if (playing) {
        phase = 'running';
        last = now();
      } else {
        phase = 'armed';
      }
    },
    onPlay() {
      if (phase === 'armed') {
        phase = 'running';
        last = now();
      }
    },
    onPause() {
      if (counting()) reset();
    },
    tick() {
      sync();
      const out: TimerTick = {};
      if (phase === 'running' && remaining <= fadeMs) {
        phase = 'fading';
        out.startFade = fadeMs / 1000;
      }
      if (phase === 'fading' && remaining <= 0) {
        reset();
        out.finished = true;
      }
      return out;
    },
    phase: () => phase,
    remainingMs() {
      sync();
      return remaining;
    },
    label() {
      sync();
      return counting() ? formatRemaining(remaining) : null;
    },
  };
}
