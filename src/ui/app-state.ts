import type { NoiseId } from '../types';

/** Transient, non-persisted UI state shared by the ui modules. */
export interface AppState {
  playing: boolean;
  compare: boolean;
  immersive: boolean;
  peekType: NoiseId | null;
  suppressLeft: boolean;
  suppressRight: boolean;
  timerLabel: string | null;
}

export const DEFAULT_APP_STATE: AppState = {
  playing: false,
  compare: false,
  immersive: false,
  peekType: null,
  suppressLeft: false,
  suppressRight: false,
  timerLabel: null,
};
