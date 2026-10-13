# Noise Hue — v1 design spec

- **Date:** 2026-10-13
- **Status:** Draft for review
- **Domain:** noisehue.app
- **Source of truth for look & behavior:** `docs/prototype/prototype-docked.dc.html` (the finished "docked" Design-canvas prototype). Where this spec is silent, match the prototype.

## 1. Purpose and success criteria

Noise Hue is a web app for choosing a noise color (white, grey, brown, pink, green, blue, violet, orange), shaping it with a few sound options, and listening — commonly to fall asleep, focus, or mask sound.

v1 is successful when:

1. It reproduces the docked prototype's layout, behavior, and feel on desktop and mobile.
2. It adds a **sleep timer with fade-out** and **saved presets**.
3. It is a plain Vite + TypeScript app (no UI framework) with typed, testable modules and passing automated tests.
4. `npm run build` produces a static `dist/` deployable to any static host.

### Decisions already made

| Topic | Decision |
|---|---|
| Stack | Vite + TypeScript (strict), vanilla DOM, no UI framework |
| Layout | Docked prototype is the base; the original "Main" layout is retired |
| Background playback | **Out of scope.** Foreground-only live Web Audio (like the prototype). Sound may stop when a phone locks. |
| Media Session / lock-screen controls | Out of scope for v1 |
| Installable / offline (PWA) | Out of scope for v1 |
| Tweaks | Become fixed constants in `config.ts` (not user settings) |
| Hosting | Out of scope; build output is host-agnostic |
| Project location | `~/Projects/noisehue` (git repo). Dependencies are installed by the user on macOS (`npm install`). |

## 2. Fixed configuration (former Tweaks)

All values live in `src/config.ts` as typed constants.

| Area | Setting | Value |
|---|---|---|
| Start | Default color for first visit | `white` |
| Volume | Curve | decibel: gain = 10^((−40 dB × (1 − v/100)) / 20), 0 → silence |
| Volume | Default | 50 % |
| Background | Shape | `glow` (radial ellipse rising from the bottom edge, x follows pan) |
| Background | Strength curve | `squared` (s = v²) |
| Background | Color blend | `srgb` |
| Background | Eased stops | on (9 smoothstep stops) |
| Background | Peak opacity | 20 % |
| Background | Min / max height | 0 % / 50 % (used by band/mirror math; keep the generalized function) |
| Background | Center | 10 % (mirror only; kept for completeness) |
| Motion | Mode | `waves` (animated gradient wobble; no blobs) |
| Motion | Speed / intensity / audio-sync | 1× / 50 % / off |
| Color ring | Selected-color animation while playing | `ripple` |
| Color ring | Warp wave count | 3 (unused unless ring = warp; keep the function) |
| Title dot | Animation on color change | `bounce` |
| Waveform | Hide when stopped | yes (fade 0.6 s) |
| Waveform | Dark backing band | no |

Only the chosen variants need UI code paths. Keep `warpRingPath`, band/mirror math, and blob code **out** of v1 unless trivially shared (YAGNI); the config table records the chosen values.

## 3. Noise catalog

`src/noise/catalog.ts`, order as displayed:

| id | Name | Swatch | Slope label | Base generator | Tilt | Description |
|---|---|---|---|---|---|---|
| white | White | #E8E6E3 | flat · 0 dB/oct | white | 0 | (from prototype) |
| grey | Grey | #A7AFB9 | flat to the ear | white + grey filter chain | 0 | (from prototype) |
| brown | Brown | #C49468 | −6 dB/oct | leaky-integrated white (corner = brownCorner) | −6 | |
| pink | Pink | #F2A7C3 | −3 dB/oct | Paul Kellet pink filter | −3 | |
| green | Green | #8CC79A | mid band · ~500 Hz | pink + band (HP/LP at center ÷/× 2^width, +4 dB peak) | −3 | |
| blue | Blue | #7FB2F0 | +3 dB/oct | differentiated pink | +3 | |
| violet | Violet | #B49CF2 | +6 dB/oct | differentiated white | +6 | |
| orange | Orange | #F0A35E | −3 dB/oct · note gaps | pink + notches at every semitone (A = tune) | −3 | |

Descriptions are copied verbatim from the prototype's `NOISE_TYPES`.

## 4. Settings model

```ts
type NoiseId = 'white'|'grey'|'brown'|'pink'|'green'|'blue'|'violet'|'orange';

interface SoundOptions {           // defaults → limits
  tilt: number;         // 0      [-12, 12] dB
  lowCut: number;       // 20     [20, 300] Hz   (≤21 shows "Off")
  highCut: number;      // 20000  [2000, 20000] Hz (≥19900 shows "Off")
  width: number;        // 0      [0, 100] %
  pan: number;          // 0      [-100, 100] (|v|≤3 snaps to 0)
  waveDepth: number;    // 0      [0, 100] %
  wavePeriod: number;   // 8      [4, 20] s
  brownCorner: number;  // 150    [20, 300] Hz
  greenCenter: number;  // 500    [200, 2000] Hz
  greenWidth: number;   // 2      [1, 3] octaves
  greyStrength: number; // 100    [0, 100] %
  orangeQ: number;      // 30     [5, 60]
  orangeTune: number;   // 440    [415, 466] Hz
}

interface Settings extends SoundOptions {
  type: NoiseId;        // default config.startType
  volume: number;       // 50  [0, 100]
  muted: boolean;       // false
}

interface UiPrefs { pinLeft: boolean; pinRight: boolean; foldLeft: boolean; foldRight: boolean; sleepMinutes: number; }
interface Preset { id: string; name: string; type: NoiseId; options: SoundOptions; }
```

Slider ↔ value mappings (log scales, labels, "Off" thresholds, value text) are ported exactly from the prototype's `renderVals`.

### Persistence (`state/persist.ts`)

- Keys: `noisehue:settings`, `noisehue:ui`, `noisehue:presets`.
- On first load, if new keys are absent, import once from `noise-app-config` / `noise-app-panes`, then write new keys (old keys are left untouched).
- Every value is validated on load (type + range); invalid fields fall back to defaults.
- All storage access is wrapped in try/catch; failure means "don't save", never a crash.

### Store (`state/store.ts`)

`createStore<T>(initial)` → `{ get(): T; set(patch: Partial<T>): void; subscribe(fn: (s: T, prev: T) => void): () => void }`. Synchronous notify; `set` with no actual change does not notify. One store for `Settings`, one for transient app state (`playing`, `compare`, `immersive`, `peekType`, `suppressLeft/Right`, timer state).

## 5. Audio engine (`audio/`)

Live Web Audio, structured as in the prototype:

```
BufferSource (8 s stereo loop, seamless crossfade-loop) → voice gain (0.3 s fade in/out on switch)
  → master gain → [width matrix: split/merge, L = c·a + s·b, R = c·a − s·b]
  → lowCut (HP, Q .707) → highCut (LP, Q .707) → tilt (lowshelf 800 Hz −t/2, highshelf 1250 Hz +t/2)
  → wave gain (LFO 1/period Hz, depth/2) → StereoPanner → Analyser (fft 8192) → destination
```

- `generators.ts` (pure, no DOM): `makeNoiseChannel(sampleRate, length, id, options)`, `filterChain`, `biquad`, `applyBiquad`, `biquadMagDb`, `idealDb`. Buffers are cached by a signature of the color + its color-specific options; color-specific option changes regenerate after a 250 ms debounce.
- `engine.ts` API: `play(id)`, `pause()`, `switchTo(id)` (crossfade), `setLevel(gain, rampSec)`, `applyOptions(options)`, `setPan`, `getWaveform()`, `measureBands()`, `fadeOutAndPause(seconds)` (used by the sleep timer), `dispose()`.
- AudioContext is created lazily on the first user gesture; `resume()` on play. Pause ramps master to 0, stops the voice after 0.5 s, and suspends the context.
- If `AudioContext` is unavailable: show an inline message in the player ("Your browser can't play generated audio") and disable transport controls.

## 6. Interface

Faithful port of the prototype. Static structure in `index.html`; modules attach behavior and update text/attributes/classes/CSS variables.

### Desktop (≥ 62.5em)

Three-column grid `var(--lw) 1fr var(--rw)` (pinned 18.75rem / 22.5rem; unpinned 3rem rails), height `100dvh`.

- **Color panel (left):** header "Color" + pin; list of 8 color buttons (3rem swatch, name, slope). Selected row tinted; ripple ring while playing. Hover: inset border in that color (`color-mix(... 70%)`, none on `hover:none`). Hover/focus previews that color's description.
- **Center:** title "noise ● hue" (dot in accent, bounce on color change, `sr-only` space), status (Paused #F2867E / Muted #EBC66A / Playing #74D69A, with "· Nm left" when a timer runs), selected-color line (name + slope), waveform (click toggles compare), description on dark blurred backing, floating playback bar.
- **Playback bar:** play/pause (accent fill, ripple + ring while playing), mute button (icon reflects muted/low/high), volume slider + readout, status, then right-aligned icon buttons: **sleep timer**, **compare**, **fullscreen** (all 3.25rem circles, 1.5rem icons).
- **Sound panel (right):** header [pin][Sound] … [Reset]; **Presets** row; groups (color settings when present, Tone, Space, Waves) with changed-dots, double-click-to-default sliders, Wave length dimmed when depth = 0.
- **Collapsible panels:** unpinned → rail with icon + vertical label; opens on hover/focus-within; closes 150 ms after pointer leaves (blurring focus inside); unpinning collapses immediately (suppressed until pointer leaves). Color description hidden while the color panel is unpinned (hover preview still shows it).
- **Fullscreen:** button requests browser fullscreen (best effort) and enters immersive mode: panels and bar fade, grid columns collapse, title and selected-color line always hidden, description hidden while audible; transparent full-screen exit button with "Click or press any key to exit" hint (fades after 3 s); any key except Tab/modifiers or a click exits; leaving browser fullscreen exits.

### Mobile (< 62.5em)

Single column, order: center (player), colors, sound. Colors grid 3 cols, 2 below 50em, 1 below 31.25em. Panels foldable via full-width header bars (stretched button) with summaries ("● Pink · Show colors", "Show sound options · Defaults / N changed"); folded panels stack flush with hairline separators. Touch sizes: play 4rem, mute 3.25rem, icon buttons 3.5rem, sliders 3.25rem tall, larger type as in the prototype. Playback bar `position: sticky; bottom: 0` within the player.

### Visual system

- Fonts: Instrument Sans (UI), IBM Plex Mono (labels/values) via Google Fonts.
- Tokens in `styles/tokens.css`: `--bg #0E1116`, `--panel #151A21`, `--panel-2 #1C232C`, `--line #232A33`, `--line-2 #2A323D`, `--text #E9E7E2`, `--text-2 #C4CAD2`, `--muted #9AA3AE`, status colors, `--accent` (set at runtime from the selected color).
- Units: rem for type/spacing/sizes, px for borders/shadows, `100dvh`, em breakpoints. No `!important` except where overriding UA styles.
- Background: glow gradient rebuilt only when inputs change or while the waves motion ticks (≤ 30 fps when not playing; per-frame while playing).
- `prefers-reduced-motion`: disable wave motion, ripples, dot animation, ring pulse, and panel slide transitions.

## 7. v1 additions

### 7.1 Sleep timer (`ui/transport.ts` + `state/timer.ts`)

- Moon icon button in the playback bar (left of compare). Opens a small popover: Off, 15, 30, 45, 60, 90 min, Custom (number input 1–480). Popover is keyboard accessible (Esc closes, focus returns to the button).
- Timer can be set while paused; it starts counting when playback starts. Setting it while playing starts immediately.
- While running: button shows remaining time ("27m", "<1m") tinted accent; status gets "· 27m left".
- Fade: last 60 s (or 20 % of the duration if under 5 min) the engine ramps a dedicated **timer gain** node (not the volume setting) to 0, then pauses and resets the timer gain to 1. The volume slider never moves.
- Manual pause cancels the timer. Color/option/preset changes and fullscreen don't affect it.
- `UiPrefs.sleepMinutes` remembers the last choice for the popover default; a timer never auto-starts after reload.
- Timer logic is a pure state machine driven by an injectable clock (for tests).

### 7.2 Presets (`ui/presets.ts` + `state/presets.ts`)

- Preset = `{ id, name, type, options: SoundOptions }`. Volume and mute are excluded.
- Presets row at the top of the sound panel: chips with color dot + name, plus "+ Save".
- Save: inline input prefilled "<Color> N" (next free N); Enter saves, Esc cancels; names trimmed, 1–32 chars, duplicates allowed. Max 20 presets (Save disabled with a tooltip at the cap).
- Apply: sets type + options; crossfades if playing, stays paused otherwise.
- Delete: small × on each chip, no confirmation.
- Active chip highlighted when the current type + options deep-equal a preset; clears on any change.
- Stored in `noisehue:presets`, validated on load.

## 8. Error handling

| Case | Behavior |
|---|---|
| No Web Audio | Inline message; transport disabled; rest of UI usable |
| Autoplay policy | Context created/resumed only from user gestures |
| Storage blocked/quota | Silently skip saving; app works with defaults |
| Corrupt stored data | Field-level fallback to defaults |
| Fullscreen API refused | Immersive mode still works in-page |
| `color-mix` unsupported | Hover border falls back to `var(--line-2)` |

## 9. Testing

**Automated (Vitest, `jsdom` where DOM is needed):**

- `generators.test.ts`: generate 2^16+ samples per color, compute an averaged FFT, fit slope over 100 Hz–8 kHz in octave bands: white ≈ 0, pink ≈ −3, brown ≈ −6 (above corner), blue ≈ +3, violet ≈ +6 dB/oct (± 1 dB); green energy peaks near center; orange shows notches at semitone frequencies; grey matches its filter curve; output is normalized and clipped to [−1, 1]; loop seam is continuous.
- `persist.test.ts`: validation/clamping, legacy-key migration (once), storage failure tolerance.
- `store.test.ts`: subscribe/notify, no-op sets.
- `volume.test.ts`: dB curve endpoints and monotonicity; mute.
- `timer.test.ts`: countdown, fade start for long/short timers, cancel on pause, set-while-paused.
- `presets.test.ts`: save/apply/delete/cap/naming/active-match.
- `reset.test.ts`: Reset restores volume + options, keeps type.

**Manual checklist** (in `docs/qa-checklist.md`): desktop pin/unpin/hover/close-after-click; color hover border + description preview; ripple on selected color and play button; title dot bounce; compare via icon and waveform click; fullscreen enter/exit paths and what hides when; sleep timer full run with fade; presets save/apply/delete; mobile 3/2/1 columns, fold bars, touch sizes, sticky bar; reduced motion; keyboard-only pass; Safari, Chrome, Firefox, Edge (desktop) and iOS Safari, Android Chrome.

## 10. Tooling and repo

- Vite (vanilla-ts template), TypeScript `strict` + `noUncheckedIndexedAccess`, ESLint (typescript-eslint) + Prettier, Vitest.
- Scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `test`, `lint`, `format`.
- Node ≥ 20 (`.nvmrc` = 20). `node_modules` is never committed; the user runs `npm install` on macOS.
- Git repo at `~/Projects/noisehue`, with `.gitignore` for `node_modules`, `dist`, `.DS_Store`.

## 11. Out of scope (v1)

Background/lock-screen playback, Media Session, PWA/offline, analytics, accounts/sync, hosting and DNS setup, layering multiple noises, alternative layouts, custom slider thumbs, in-app settings for former Tweaks.
