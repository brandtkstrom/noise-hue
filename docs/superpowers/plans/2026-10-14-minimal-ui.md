# Noise Hue Minimal UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the v1 UI on branch `minimal-ui` with a stripped-down, mobile-first single-column UI: no visualisation, panels, fullscreen, presets, sleep timer or animations — keep the 8 noise colors, live audio engine, sound options, volume/mute and persisted settings. The background becomes a static accent-tinted vertical gradient.

**Branch:** `minimal-ui` (already created off `main`; `main` keeps the full app untouched).

**Scope (confirmed with the user):**

| Keep | Cut |
| --- | --- |
| 8 noise colors + descriptions | waveform + compare visualiser (`src/viz/`, `src/ui/viz.ts`) |
| play/pause, volume, mute | immersive fullscreen (`ui/immersive.ts`) |
| all 13 sound-option sliders in a native `<details>` | pinned/rail/fold panel system (`ui/panels.ts`) |
| settings persistence (`noisehue:settings`) | presets (`ui/presets.ts`, `state/presets.ts`) |
| accent selection line, title dot | sleep timer (`ui/timer-popover.ts`, `state/timer.ts`) |
| | every `@keyframes`/`transition` and the reactive background glow |
| | engine analyser and sleep-timer fade |
| | Google Fonts (system font stack) |

**Design:** single column, `max-width: 32rem`, centred; mobile-first padding with a comfort bump at `≥40em`. Static `linear-gradient(180deg, var(--bg), color-mix(in srgb, var(--accent) 12%, var(--bg)))` on `#app`; `--accent` is still set from the selected color, so the gradient changes only when the color changes. Color chips (swatch + name) flow in an `auto-fill` grid; the player is a plain bordered card; sound options sit in a closed-by-default `<details>`.

**Architecture:** unchanged in shape — one `Settings` store, a tiny `AppState = { playing }`, settings-only persistence, pure state/audio modules, thin DOM modules wired by `main.ts`. The only state/audio changes are deletions.

**Tech Stack:** unchanged — Vite 8, TypeScript ~6.0 strict, Vitest 5 + jsdom, ESLint 10 + typescript-eslint 8, Prettier 3, no runtime dependencies.

## Global Constraints

- Branch `minimal-ui`; never touch `main`.
- No new runtime dependencies, no UI framework.
- No `@keyframes`, no CSS `transition`, no `requestAnimationFrame` in app code. Color changes are instant.
- Every `$('#id')`/class query used by modules must exist in the new `index.html`; `$()` throws on missing elements, so the jsdom tests are the canary.
- Units: rem for type/spacing/sizes, px only for borders; `100dvh` (never `100vh`).
- System fonts only: `system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif` and `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`.
- Copy stays verbatim: color names, slope labels, descriptions, value text, statuses, `"Your browser can't play generated audio"`.
- Keep storage key `noisehue:settings` and the one-time `noise-app-config` migration. Stop reading/writing `noisehue:ui` and `noisehue:presets`; leave any existing data untouched.
- Every task ends with `npm test`, `npm run lint`, `npm run build` all green.

## Review Focus

1. **Persisted data from the full app** → still loads: settings sanitize unchanged, `noisehue:ui`/`noisehue:presets` ignored, legacy migration intact. *Pinned in Task 1:* `persist.test.ts › migrates the legacy config once`, `validate.test.ts › sanitizes junk fields individually`.
2. **No Web Audio** → `#unsupported` shows, `#play`/`#mute`/`#vol` disabled, rest of the page usable. *Pinned in Task 1:* `main.dom.test.ts › shows the unsupported notice and disables the audio controls`.
3. **Color switch while playing** → engine still crossfades (`syncEngine` type change → `switchTo`). *Pinned in Task 1:* `engine-sync.test.ts › type change while playing switches to the new color...`.
4. **Markup/JS drift** → all DOM tests mount every module against `index.html?raw`; a missing element fails fast.
5. **Gradient without `color-mix`** → `background-color: var(--bg)` is declared first, so the page keeps a solid background if the gradient is dropped.

## File map

```
index.html                     new single-column markup (all regions)
styles/app.css                 tokens + base + layout + controls (new, replaces 3 files)
src/main.ts                    wiring: persistence, settings+app stores, engine, 3 UI modules
src/config.ts                  startType, defaultVolume, volumeFloorDb only
src/types.ts                   NoiseId, SoundOptions, Settings, ColorOptionKey
src/noise/catalog.ts           unchanged (8 colors)
src/state/defaults.ts          OPTION_DEFAULTS/KEYS/LIMITS, DEFAULT_SETTINGS, VOLUME_LIMITS
src/state/validate.ts          sanitizeSettings only
src/state/persist.ts           settings load/save + legacy migration only
src/state/store.ts             unchanged
src/state/mappings.ts          volume curve, scales, value text, status, optionsOf
src/audio/generators.ts        unchanged
src/audio/params.ts            unchanged
src/audio/engine.ts            no analyser / timerGain / fadeOut
src/ui/dom.ts                  unchanged
src/ui/app-state.ts            { playing: boolean }
src/ui/colors.ts               color chips, accent, selection line, description
src/ui/sound.ts                option sliders, color group, reset
src/ui/transport.ts            play/pause, volume/mute, status
docs/qa-checklist.md           rewritten for the minimal UI
README.md                      structure/notes updated
```

Deleted: `src/viz/` (whole dir), `src/ui/{panels,immersive,presets,timer-popover,viz}.ts` and their `.dom.test.ts`, `src/state/{timer,presets}.ts` and their `.test.ts`, `styles/{tokens,layout,components}.css`.

---

### Task 0: Commit the plan

**Files:**

- Create (already on disk): `docs/superpowers/plans/2026-10-14-minimal-ui.md`

- [ ] **Step 1:** Confirm you are on `minimal-ui` (`git switch minimal-ui`; it already exists) and commit the plan: `docs: add minimal-ui implementation plan`.

---

### Task 1: Minimal UI (markup, styles, modules, state, tests)

This is one coupled change: the new markup, modules, state layer and test updates must land together or nothing type-checks. Run the verification only at the end of the task.

**Files:**

- Rewrite: `index.html`, `styles/app.css` (new), `src/ui/app-state.ts`, `src/ui/colors.ts`, `src/ui/sound.ts`, `src/ui/transport.ts`, `src/main.ts`, `src/config.ts`, `src/types.ts`, `src/state/defaults.ts`, `src/state/validate.ts`, `src/state/persist.ts`, `src/state/mappings.ts`
- Modify: `src/app/engine-sync.ts` (one import line only)
- Update tests: `src/main.dom.test.ts`, `src/ui/colors.dom.test.ts`, `src/ui/sound.dom.test.ts`, `src/ui/transport.dom.test.ts`, `src/state/mappings.test.ts`, `src/state/validate.test.ts`, `src/state/persist.test.ts`, `src/app/engine-sync.test.ts`
- Delete: `styles/tokens.css`, `styles/layout.css`, `styles/components.css`, `src/viz/` (all), `src/ui/{panels,immersive,presets,timer-popover,viz}.ts`, `src/ui/{panels,immersive,presets,viz}.dom.test.ts`, `src/state/timer.ts`, `src/state/timer.test.ts`, `src/state/presets.ts`, `src/state/presets.test.ts`

- [ ] **Step 1: Replace `index.html`** with the markup in Appendix A. Keep `<head>` as is except: delete both `googleapis`/`gstatic` preconnect+stylesheet links, link only `/styles/app.css`.
- [ ] **Step 2: Add `styles/app.css`** exactly as in Appendix B, then delete the three old stylesheets.
- [ ] **Step 3: Delete obsolete sources/tests** listed above (`git rm` or `rm`), including the whole `src/viz/` directory.
- [ ] **Step 4: Simplify the state layer.**
  - `src/config.ts` → `{ startType: 'white', defaultVolume: 50, volumeFloorDb: -40 } as const` (delete `bg`, `motion`, `ringAnim`, `warpWaves`, `dotAnim`, `hideWaveWhenStopped`, `waveBacking`).
  - `src/types.ts` → delete `UiPrefs` and `Preset`; keep `NoiseId`, `SoundOptions`, `Settings`, `ColorOptionKey`.
  - `src/state/defaults.ts` → delete `DEFAULT_UI`, `SLEEP_MINUTES_LIMITS`, `MAX_PRESETS`, `MAX_PRESET_NAME` and the `UiPrefs` import; keep the rest.
  - `src/state/validate.ts` → keep only `sanitizeSettings` (with private `sanitizeOptions`, `num`, `bool`, `noiseId`); delete `sanitizeUi`, `sanitizePresets`, `sanitizePreset` and their imports.
  - `src/state/persist.ts` → `interface Persistence { loadSettings(): Settings; saveSettings(s: Settings): void }`; keep `KEY_SETTINGS` and `LEGACY_CONFIG` migration; delete `KEY_UI`, `KEY_PRESETS`, `LEGACY_PANES`, the UI/preset load/save methods and their imports.
  - `src/state/mappings.ts`:
    - add `export function optionsOf(s: Settings): SoundOptions` looping `OPTION_KEYS` (moved from `state/presets.ts`);
    - delete `ChangeSummary`, `changeSummary`, `ALL_COLOR_KEYS` and the now-unused `ALL_COLOR_OPTION_KEYS`/`colorKeysFor` imports (keep `LOW_CUT_OFF`/`HIGH_CUT_OFF` for the value text; drop the "dots/summary" wording from their comment);
    - change to `statusText(playing: boolean, s: Settings): string` (drop `timerLabel`);
    - replace `statusColor` with `export type StatusState = 'paused' | 'muted' | 'playing'; export function statusState(playing: boolean, s: Settings): StatusState` (`!playing → 'paused'`, `effectiveVolume(s) === 0 → 'muted'`, else `'playing'`).
  - `src/app/engine-sync.ts` → change the `optionsOf` import from `../state/presets` to `../state/mappings`; nothing else changes.
- [ ] **Step 5: Rewrite the UI modules.**
  - `src/ui/app-state.ts`:
    ```ts
    export interface AppState {
      playing: boolean;
    }
    export const DEFAULT_APP_STATE: AppState = { playing: false };
    ```
  - `src/ui/colors.ts` → replace with Appendix C.
  - `src/ui/sound.ts` → keep `SLIDERS`, `SliderDef`, `toValue`, `fromPos`, `Slider`, `syncSlider` unchanged. In `mountSound`: drop the `dblclick` listener; drop the changed-dot/`#fold-right-summary` lookups and their render lines; the render body becomes: sync sliders → show `#grp-color` + `#grp-color-title` + `#opts-<id>` for colors with options → `toggleClass(wavePeriodField, 'is-dim', s.waveDepth === 0)`. Keep the `#reset` behavior (keeps type; resets volume `DEFAULT_SETTINGS.volume`, mute and all options).
  - `src/ui/transport.ts` → replace with Appendix D; `EnginePort` becomes `Pick<NoiseEngine, 'play' | 'pause' | 'setLevel' | 'playing'>`; the module returns `void` (no `tick`).
  - `src/main.ts` → replace with Appendix E.
- [ ] **Step 6: Update the tests.**
  - `src/main.dom.test.ts`: remove the `requestAnimationFrame`/`cancelAnimationFrame` stubs; change the disabled-controls list to `['#play', '#mute', '#vol']`. Nothing else changes.
  - `src/ui/colors.dom.test.ts`: rewrite — setup without `AppState`; tests: 8 static buttons with `white` pressed initially; click sets type and pressed states; `--accent`, `#sel-name`, `#sel-slope`, `#desc` follow the current color (`pink` → `#F2A7C3`, "Pink noise", "−3 dB/oct", `/^Softer highs/`). Delete the bounce and peek tests.
  - `src/ui/sound.dom.test.ts`: delete `double-click resets that field to its default` and `changed dots and the fold summary follow the change summary`; in `shows the color group...` remove the `dotHidden` helper/assertions. Keep everything else.
  - `src/ui/transport.dom.test.ts`: rewrite. Setup: `settings`, `app`, `stubEngine()` returning `{ playing, play, pause, setLevel }`; mount `{ settings, app, engine }`. Keep the play/pause describe (drop `play-ripple` assertions; keep stale-resume and constructor-throw tests), the volume/mute describe (drop the low-icon test; replace `#mute .icon-vol-high`/`-low` with `#mute .icon-vol-on`), and status tests asserting `#status` text plus `dataset.state` (`'paused' | 'muted' | 'playing'`) instead of inline colors. Delete the compare and sleep-timer describes.
  - `src/state/validate.test.ts`: keep the two settings tests; delete the UI/preset tests and their imports/helpers.
  - `src/state/persist.test.ts`: rewrite as in Appendix F.
  - `src/state/mappings.test.ts`: drop the `changeSummary`/`statusColor` imports and the whole `changes` describe; update the `status` test to the new `statusText(playing, s)` + `statusState`; add an `optionsOf` test (keys equal `OPTION_KEYS`, values copied, no `type`/`volume`/`muted`). Keep the rest.
  - `src/app/engine-sync.test.ts`: import `optionsOf` from `../state/mappings` (combine with the `volumeGain` import); rename the `a preset apply ...` test to `a color + options change at once applies options and switches to the new color`.
- [ ] **Step 7: Verify.**
  - `npm test` → all remaining suites pass.
  - `npm run lint`, `npm run build` → clean.
  - `rg -n "UiPrefs|sanitizeUi|sanitizePresets|changeSummary|statusColor|peekType|suppressLeft|suppressRight|timerLabel|compare|immersive" src` → no matches.
  - `rg -n "state/presets|state/timer|ui/panels|ui/immersive|ui/presets|ui/timer-popover|ui/viz|viz/" src` → no matches.
- [ ] **Step 8: Commit:** `feat: replace the UI with a minimal single-column layout`.

### Task 2: Strip the analyser and sleep-timer fade from the engine

Now nothing references them (Task 1 removed the visualiser and timer UI).

**Files:**

- Modify: `src/audio/engine.ts`, `src/audio/engine.test.ts`, `src/audio/fake-context.test-util.ts`

- [ ] **Step 1: `src/audio/engine.ts`**
  - Delete `type FadeResult`, `WAVE_WINDOW`, private fields `fadeTimer`, `fadeResolve`, `bands`, and the `Graph` fields `timerGain`, `analyser`, `wave`, `freq`.
  - Delete methods `readWaveform`, `measureBands`, `fadeOut`, `cancelFade`, `abortFade`, `resetTimerGain`.
  - `play()`: drop `this.abortFade()`.
  - `pause()`: drop `this.abortFade(false)` and, in the stop callback, `this.resetTimerGain(0.01)` and `this.bands = null`.
  - `dispose()`: drop `this.abortFade(false)` and `this.bands = null`.
  - `ensureGraph()`: don't create the analyser or timerGain; wire `waveGain → (panner ?? ctx.destination)` and, when a panner exists, `panner → ctx.destination`; prune the returned graph object.
- [ ] **Step 2: `src/audio/fake-context.test-util.ts`** — delete `FakeAnalyser`, the `analysers` field and `createAnalyser()`.
- [ ] **Step 3: `src/audio/engine.test.ts`**
  - Delete the `timerGainOf` helper; keep the `FakeGain` import for `masterOf`.
  - Remove `expect(c.analysers[0]!.fftSize).toBe(8192)` (creates-context test) and `expect(e.readWaveform(64)).toBeNull()` (pause test).
  - Delete the six fade tests (`fadeOut ...`, `fadeOut is cancelled by play`, `cancelFade ...`, `cancelFade is a no-op ...`, `a second fadeOut ...`).
  - In `works without StereoPannerNode`, replace the analyser assertion with `expect(c.gains.some((g) => g.connections.includes(c.destination))).toBe(true)`.
  - Delete the `readWaveform`/`measureBands` tests.
  - Rewrite the dispose test: play, `dispose()`, expect `closeCalls === 1` and `playing === false` (no fade promise).
- [ ] **Step 4: Verify:** `npm test`, `npm run lint`, `npm run build`; `rg -n "analyser|timerGain|fadeOut|cancelFade|readWaveform|measureBands|FadeResult" src` → no matches.
- [ ] **Step 5: Commit:** `refactor: drop the analyser and sleep-timer fade from the engine`.

### Task 3: Docs and final checks

**Files:**

- Modify: `README.md`, `docs/qa-checklist.md`

- [ ] **Step 1: `README.md`** — describe the minimal single-column UI; remove timer/presets/compare/fullscreen mentions; update the project-structure block (`styles/app.css`; `ui/` = dom, app-state, colors, sound, transport; no `viz/`); notes: only `noisehue:settings` is used (old `noisehue:ui`/`:presets` data is ignored); docs: link this plan + QA checklist (keep the v1 spec link as history).
- [ ] **Step 2: `docs/qa-checklist.md`** — replace with a short minimal checklist: visual pass at 360×640, 768, 1280 (centred column, static gradient tint follows the color, nothing animates); color selection + description; play/pause, volume, mute, status text/state; color switch while playing; options details open/close (pointer + keyboard), every slider changes sound and value text, wave length dims at depth 0, reset restores defaults keeping the color; reload keeps settings; corrupt storage falls back; no-Web-Audio notice and disabled controls; keyboard-only pass with visible focus; iOS Safari / Android Chrome / desktop Chrome-Safari-Firefox-Edge.
- [ ] **Step 3: Final verification.**
  - `npm test && npm run lint && npm run build` → green.
  - Manual smoke: `npm run dev`, then check phone width (device toolbar) and desktop width; play, switch colors, open options, reload.
  - `rg -n "gradient|keyframes|transition|animation" styles src --glob '!*test*'`: only the static `linear-gradient` in `styles/app.css` (and none in `src/`).
- [ ] **Step 4: Commit:** `docs: update README and QA checklist for the minimal UI`.

---

## Appendix A: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="Noise Hue: choose a noise color, shape it, and listen." />
    <meta name="theme-color" content="#0E1116" />
    <title>Noise Hue</title>
    <link rel="stylesheet" href="/styles/app.css" />
  </head>
  <body>
    <div id="app" class="app">
      <div class="shell">
        <header class="head">
          <h1 class="title">
            noise<span class="sr-only"> </span
            ><span id="title-dot" class="title-dot" aria-hidden="true"></span>hue
          </h1>
          <p class="selection">
            <span id="sel-name" class="sel-name">White noise</span>
            <span id="sel-slope" class="sel-slope">flat · 0 dB/oct</span>
          </p>
        </header>

        <div id="color-list" class="color-list" role="group" aria-label="Noise color">
          <button
            type="button"
            class="color-btn"
            data-type="white"
            aria-pressed="true"
            aria-label="White noise"
            style="--c: #e8e6e3"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">White</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="grey"
            aria-pressed="false"
            aria-label="Grey noise"
            style="--c: #a7afb9"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Grey</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="brown"
            aria-pressed="false"
            aria-label="Brown noise"
            style="--c: #c49468"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Brown</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="pink"
            aria-pressed="false"
            aria-label="Pink noise"
            style="--c: #f2a7c3"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Pink</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="green"
            aria-pressed="false"
            aria-label="Green noise"
            style="--c: #8cc79a"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Green</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="blue"
            aria-pressed="false"
            aria-label="Blue noise"
            style="--c: #7fb2f0"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Blue</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="violet"
            aria-pressed="false"
            aria-label="Violet noise"
            style="--c: #b49cf2"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Violet</span>
          </button>
          <button
            type="button"
            class="color-btn"
            data-type="orange"
            aria-pressed="false"
            aria-label="Orange noise"
            style="--c: #f0a35e"
          >
            <span class="swatch" aria-hidden="true"></span><span class="color-name">Orange</span>
          </button>
        </div>

        <p id="desc" class="desc"></p>

        <section class="player" aria-label="Playback">
          <div class="transport">
            <button type="button" id="play" class="play-btn" aria-label="Play" title="Play">
              <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path
                  d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"
                ></path>
              </svg>
              <svg
                class="icon-pause"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
                hidden
              >
                <rect x="6" y="5" width="4" height="14" rx="1"></rect>
                <rect x="14" y="5" width="4" height="14" rx="1"></rect>
              </svg>
            </button>
            <p id="status" class="status" data-state="paused" aria-live="polite">Paused</p>
          </div>
          <div class="vol-row">
            <button type="button" id="mute" class="mute-btn" aria-pressed="false" aria-label="Mute" title="Mute">
              <svg
                class="icon-vol-muted"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
                hidden
              >
                <path d="M11 5 6 9H3v6h3l5 4V5z"></path>
                <path d="m16 9 6 6"></path>
                <path d="m22 9-6 6"></path>
              </svg>
              <svg
                class="icon-vol-on"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M11 5 6 9H3v6h3l5 4V5z"></path>
                <path d="M15.5 8.5a5 5 0 0 1 0 7"></path>
                <path d="M18.5 5.5a9 9 0 0 1 0 13"></path>
              </svg>
            </button>
            <label for="vol" class="sr-only">Volume</label>
            <input id="vol" class="range" type="range" min="0" max="100" step="1" value="50" />
            <span id="vol-readout" class="vol-readout" aria-hidden="true">50%</span>
          </div>
          <p id="unsupported" class="unsupported" role="alert" hidden>
            Your browser can't play generated audio
          </p>
        </section>

        <details id="options" class="options">
          <summary class="options-summary">Sound options</summary>
          <div class="options-body">
            <div id="grp-color" class="opt-group" role="group" aria-labelledby="grp-color-title" hidden>
              <p id="grp-color-title" class="opt-title">White settings</p>
              <div id="opts-brown" class="opt-fields" hidden>
                <div class="field">
                  <div class="field-head">
                    <label for="browncorner">Depth</label
                    ><span id="browncorner-text" class="field-val"></span>
                  </div>
                  <input id="browncorner" class="range" type="range" min="0" max="100" step="1" value="50" />
                </div>
              </div>
              <div id="opts-green" class="opt-fields" hidden>
                <div class="field">
                  <div class="field-head">
                    <label for="greencenter">Center</label
                    ><span id="greencenter-text" class="field-val"></span>
                  </div>
                  <input id="greencenter" class="range" type="range" min="0" max="100" step="1" value="50" />
                </div>
                <div class="field">
                  <div class="field-head">
                    <label for="greenwidth">Width</label
                    ><span id="greenwidth-text" class="field-val"></span>
                  </div>
                  <input id="greenwidth" class="range" type="range" min="10" max="30" step="1" value="20" />
                </div>
              </div>
              <div id="opts-grey" class="opt-fields" hidden>
                <div class="field">
                  <div class="field-head">
                    <label for="greystrength">Hearing adjustment</label
                    ><span id="greystrength-text" class="field-val"></span>
                  </div>
                  <input id="greystrength" class="range" type="range" min="0" max="100" step="1" value="100" />
                </div>
              </div>
              <div id="opts-orange" class="opt-fields" hidden>
                <div class="field">
                  <div class="field-head">
                    <label for="orangeq">Gap width</label
                    ><span id="orangeq-text" class="field-val"></span>
                  </div>
                  <input id="orangeq" class="range" type="range" min="5" max="60" step="1" value="30" />
                </div>
                <div class="field">
                  <div class="field-head">
                    <label for="orangetune">Tuning</label
                    ><span id="orangetune-text" class="field-val"></span>
                  </div>
                  <input id="orangetune" class="range" type="range" min="415" max="466" step="1" value="440" />
                </div>
              </div>
            </div>

            <div class="opt-group" role="group" aria-label="Tone">
              <p class="opt-title">Tone</p>
              <div class="field">
                <div class="field-head">
                  <label for="tilt">Tilt</label><span id="tilt-text" class="field-val"></span>
                </div>
                <input id="tilt" class="range" type="range" min="-12" max="12" step="1" value="0" />
              </div>
              <div class="field">
                <div class="field-head">
                  <label for="lowcut">Low cut</label><span id="lowcut-text" class="field-val"></span>
                </div>
                <input id="lowcut" class="range" type="range" min="0" max="100" step="1" value="0" />
              </div>
              <div class="field">
                <div class="field-head">
                  <label for="highcut">High cut</label><span id="highcut-text" class="field-val"></span>
                </div>
                <input id="highcut" class="range" type="range" min="0" max="100" step="1" value="100" />
              </div>
            </div>

            <div class="opt-group" role="group" aria-label="Space">
              <p class="opt-title">Space</p>
              <div class="field">
                <div class="field-head">
                  <label for="pan">Panning</label><span id="pan-text" class="field-val"></span>
                </div>
                <input id="pan" class="range" type="range" min="-100" max="100" step="1" value="0" />
              </div>
              <div class="field">
                <div class="field-head">
                  <label for="width">Stereo width</label
                  ><span id="width-text" class="field-val"></span>
                </div>
                <input id="width" class="range" type="range" min="0" max="100" step="1" value="0" />
              </div>
            </div>

            <div class="opt-group" role="group" aria-label="Waves">
              <p class="opt-title">Waves</p>
              <div class="field">
                <div class="field-head">
                  <label for="wavedepth">Wave depth</label
                  ><span id="wavedepth-text" class="field-val"></span>
                </div>
                <input id="wavedepth" class="range" type="range" min="0" max="100" step="1" value="0" />
              </div>
              <div id="field-waveperiod" class="field is-dim">
                <div class="field-head">
                  <label for="waveperiod">Wave length</label
                  ><span id="waveperiod-text" class="field-val"></span>
                </div>
                <input id="waveperiod" class="range" type="range" min="4" max="20" step="1" value="8" />
              </div>
            </div>

            <button type="button" id="reset" class="reset-btn">Reset to defaults</button>
          </div>
        </details>
      </div>
    </div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

## Appendix B: `styles/app.css`

```css
/* Minimal UI: tokens, base, single-column layout, controls. No animations. */

:root {
  color-scheme: dark;
  --bg: #0e1116;
  --panel: #151a21;
  --panel-2: #1c232c;
  --line: #232a33;
  --line-2: #2a323d;
  --hover: rgba(233, 231, 226, 0.06);
  --text: #e9e7e2;
  --text-2: #c4cad2;
  --muted: #9aa3ae;
  --status-paused: #f2867e;
  --status-muted: #ebc66a;
  --status-playing: #74d69a;
  /* accent: overwritten at runtime on #app from the selected color */
  --accent: #e8e6e3;
  --font-ui: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

/* keep [hidden] hidden even where a rule sets display */
[hidden] {
  display: none !important;
}

html {
  background: var(--bg);
}

body {
  margin: 0;
  color: var(--text);
  font-family: var(--font-ui);
  -webkit-font-smoothing: antialiased;
}

button,
input {
  font: inherit;
  color: inherit;
}

button:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 2px solid var(--text);
  outline-offset: 2px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ───────── App: static accent-tinted gradient ───────── */

.app {
  min-height: 100dvh;
  /* solid fallback first: without color-mix support the gradient is dropped */
  background-color: var(--bg);
  background-image: linear-gradient(
    180deg,
    var(--bg) 0%,
    color-mix(in srgb, var(--accent) 12%, var(--bg)) 100%
  );
}

.shell {
  max-width: 32rem;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

/* ───────── Header ───────── */

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.title-dot {
  display: inline-block;
  width: 0.5rem;
  height: 0.5rem;
  margin: 0 0.375rem;
  border-radius: 50%;
  vertical-align: 0.1em;
  background: var(--accent);
}

.selection {
  margin: 0.375rem 0 0;
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.25rem 0.625rem;
}

.sel-name {
  font-size: 0.9375rem;
  font-weight: 500;
}

.sel-slope {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--muted);
}

/* ───────── Colors ───────── */

.color-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(7rem, 1fr));
  gap: 0.5rem;
}

.color-btn {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  min-height: 3rem;
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: transparent;
  color: var(--text-2);
  text-align: left;
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.color-btn:hover {
  background: var(--hover);
}

.color-btn[aria-pressed='true'] {
  border-color: var(--accent);
  background: var(--panel-2);
  color: var(--text);
}

.swatch {
  flex: none;
  width: 1.25rem;
  height: 1.25rem;
  border-radius: 50%;
  background: var(--c);
}

.color-btn[aria-pressed='true'] .swatch {
  box-shadow:
    0 0 0 2px var(--panel-2),
    0 0 0 3px var(--accent);
}

.color-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.9375rem;
  font-weight: 500;
}

/* ───────── Description ───────── */

.desc {
  margin: 0;
  color: var(--text-2);
  font-size: 0.9375rem;
  line-height: 1.5;
}

/* ───────── Player ───────── */

.player {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--panel);
}

.transport {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.play-btn {
  flex: none;
  width: 3.25rem;
  height: 3.25rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: var(--accent);
  color: var(--bg);
  cursor: pointer;
  touch-action: manipulation;
}

.play-btn svg {
  width: 1.375rem;
  height: 1.375rem;
}

.status {
  flex: 1;
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
}

.status[data-state='paused'] {
  color: var(--status-paused);
}

.status[data-state='muted'] {
  color: var(--status-muted);
}

.status[data-state='playing'] {
  color: var(--status-playing);
}

.vol-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mute-btn {
  flex: none;
  width: 2.5rem;
  height: 2.5rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  touch-action: manipulation;
}

.mute-btn svg {
  width: 1.375rem;
  height: 1.375rem;
}

.mute-btn[aria-pressed='true'] {
  color: var(--accent);
}

.range {
  flex: 1;
  min-width: 0;
  height: 2.5rem;
  accent-color: var(--accent);
  cursor: pointer;
}

.vol-readout {
  flex: none;
  width: 3rem;
  text-align: right;
  font-family: var(--font-mono);
  font-size: 0.8125rem;
  color: var(--text-2);
}

.unsupported {
  margin: 0;
  padding: 0.625rem 0.75rem;
  border: 1px solid var(--status-paused);
  border-radius: 0.5rem;
  color: var(--status-paused);
  font-size: 0.875rem;
  text-align: center;
}

/* ───────── Sound options ───────── */

.options {
  border: 1px solid var(--line);
  border-radius: 0.75rem;
  background: var(--panel);
  /* clip the summary hover background to the rounded corners */
  overflow: hidden;
}

.options-summary {
  padding: 0.875rem 1rem;
  cursor: pointer;
  font-size: 0.9375rem;
  font-weight: 500;
}

.options-summary:hover {
  background: var(--hover);
}

.options-body {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 0.25rem 1rem 1rem;
}

.opt-group,
.opt-fields {
  display: flex;
  flex-direction: column;
  gap: 0.875rem;
}

.opt-title {
  margin: 0;
  font-family: var(--font-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.field-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.field-head label {
  font-size: 0.875rem;
  font-weight: 500;
}

.field-val {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-2);
}

/* Wave length dimmed while wave depth is 0 */
.field.is-dim {
  opacity: 0.45;
}

.reset-btn {
  align-self: flex-start;
  min-height: 2.25rem;
  padding: 0 0.875rem;
  border: 1px solid var(--line-2);
  border-radius: 0.5rem;
  background: transparent;
  color: var(--text);
  font-size: 0.8125rem;
  cursor: pointer;
  touch-action: manipulation;
}

.reset-btn:hover {
  background: var(--hover);
}

/* ───────── Desktop: same column, a little more breathing room ───────── */

@media (min-width: 40em) {
  .shell {
    padding-top: 2.5rem;
  }
}

/* ───────── No Web Audio: controls are disabled (#unsupported is shown) ───────── */

.play-btn:disabled,
.mute-btn:disabled,
.range:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

## Appendix C: new `src/ui/colors.ts`

```ts
import { getNoise } from '../noise/catalog';
import type { Store } from '../state/store';
import type { NoiseId, Settings } from '../types';
import { $, setAttr, setText, setVar } from './dom';

/** Color chips: selection, the runtime accent, the selection line and the description. */
export function mountColors(settings: Store<Settings>): void {
  const root = $('#app');
  const selName = $('#sel-name');
  const selSlope = $('#sel-slope');
  const desc = $('#desc');

  const buttons = [
    ...$('#color-list').querySelectorAll<HTMLElement>('button.color-btn[data-type]'),
  ].map((el) => {
    const id = el.dataset.type as NoiseId;
    getNoise(id); // fail fast on markup drift
    // selecting a color only changes the color; playback is never started or stopped here
    el.addEventListener('click', () => {
      if (settings.get().type !== id) settings.set({ type: id });
    });
    return { id, el };
  });

  const render = (): void => {
    const current = getNoise(settings.get().type);
    for (const b of buttons) setAttr(b.el, 'aria-pressed', String(b.id === current.id));
    setVar(root, '--accent', current.color);
    setText(selName, `${current.name} noise`);
    setText(selSlope, current.slope);
    setText(desc, current.desc);
  };

  settings.subscribe(render);
  render();
}
```

## Appendix D: new `src/ui/transport.ts`

```ts
import type { NoiseEngine } from '../audio/engine';
import { CONFIG } from '../config';
import {
  effectiveVolume,
  optionsOf,
  statusState,
  statusText,
  volumeGain,
  volumeShort,
  volumeText,
} from '../state/mappings';
import type { Store } from '../state/store';
import type { Settings } from '../types';
import type { AppState } from './app-state';
import { $, setAttr, setHidden, setText } from './dom';

export type EnginePort = Pick<NoiseEngine, 'play' | 'pause' | 'setLevel' | 'playing'>;

/**
 * Player: play/pause, status, volume and mute.
 * The engine level is not set here (main subscribes the engine to settings).
 */
export function mountTransport(deps: {
  settings: Store<Settings>;
  app: Store<AppState>;
  engine: EnginePort;
}): void {
  const { settings, app, engine } = deps;
  const playBtn = $('#play');
  const iconPlay = $('.icon-play', playBtn);
  const iconPause = $('.icon-pause', playBtn);
  const status = $('#status');
  const muteBtn = $('#mute');
  const iconMuted = $('.icon-vol-muted', muteBtn);
  const iconOn = $('.icon-vol-on', muteBtn);
  const vol = $('#vol') as HTMLInputElement;
  const readout = $('#vol-readout');
  const unsupported = $('#unsupported');

  let lastVolume = settings.get().volume > 0 ? settings.get().volume : CONFIG.defaultVolume;
  /** Bumped on every play/pause so a stale resume rejection can't pause a later session. */
  let session = 0;

  function play(): void {
    const s = settings.get();
    const mine = ++session;
    let resumed: Promise<void>;
    try {
      // must run synchronously inside the click (autoplay gesture requirement)
      resumed = engine.play(s.type, optionsOf(s), volumeGain(s.volume, s.muted));
    } catch {
      // the AudioContext constructor can throw despite isSupported() (sandbox, context limit)
      setHidden(unsupported, false);
      return;
    }
    // a context that refuses to resume stays silent: don't claim Playing
    resumed.catch(() => {
      if (mine === session && app.get().playing) pause();
    });
    app.set({ playing: true });
  }

  function pause(): void {
    session++;
    engine.pause();
    app.set({ playing: false });
  }

  playBtn.addEventListener('click', () => (app.get().playing ? pause() : play()));

  vol.addEventListener('input', () => {
    settings.set({ volume: Number(vol.value), muted: false });
  });

  muteBtn.addEventListener('click', () => {
    const s = settings.get();
    if (s.muted) settings.set({ muted: false });
    else if (s.volume === 0) settings.set({ volume: lastVolume });
    else settings.set({ muted: true });
  });

  function render(): void {
    const s = settings.get();
    const a = app.get();
    const eff = effectiveVolume(s);

    const label = a.playing ? 'Pause' : 'Play';
    setAttr(playBtn, 'aria-label', label);
    setAttr(playBtn, 'title', label);
    setHidden(iconPlay, a.playing);
    setHidden(iconPause, !a.playing);

    if (vol.value !== String(s.volume)) vol.value = String(s.volume);
    setAttr(vol, 'aria-valuetext', volumeText(s));
    setText(readout, volumeShort(s));
    const muteLabel = eff === 0 ? 'Unmute' : 'Mute';
    // pressed = silent (muted or volume 0), matching the Unmute label
    setAttr(muteBtn, 'aria-pressed', eff === 0 ? 'true' : 'false');
    setAttr(muteBtn, 'aria-label', muteLabel);
    setAttr(muteBtn, 'title', muteLabel);
    setHidden(iconMuted, eff !== 0);
    setHidden(iconOn, eff === 0);

    setText(status, statusText(a.playing, s));
    setAttr(status, 'data-state', statusState(a.playing, s));
  }

  settings.subscribe((next) => {
    if (next.volume > 0) lastVolume = next.volume;
    render();
  });
  app.subscribe(render);
  render();
}
```

## Appendix E: new `src/main.ts`

```ts
import { bindEngine } from './app/engine-sync';
import { NoiseEngine } from './audio/engine';
import { createPersistence } from './state/persist';
import { createStore } from './state/store';
import type { Settings } from './types';
import { DEFAULT_APP_STATE, type AppState } from './ui/app-state';
import { mountColors } from './ui/colors';
import { $ } from './ui/dom';
import { mountSound } from './ui/sound';
import { mountTransport, type EnginePort } from './ui/transport';

const SAVE_DEBOUNCE_MS = 200;

function storageOrNull(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null; // e.g. blocked third-party storage throws on access
  }
}

/** Debounced writer with a flush for page hide / visibility hidden. */
function debounced<T>(write: (v: T) => void): { push(v: T): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { v: T } | null = null;
  const flush = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    if (pending) write(pending.v);
    pending = null;
  };
  return {
    push(v) {
      pending = { v };
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    },
    flush,
  };
}

/** Stand-in when Web Audio is missing: transport controls are disabled, so this is never driven. */
const silentEngine: EnginePort = {
  playing: false,
  play: () => Promise.resolve(),
  pause: () => {},
  setLevel: () => {},
};

function disableAudioControls(): void {
  $('#unsupported').hidden = false;
  for (const sel of ['#play', '#mute', '#vol']) {
    ($(sel) as HTMLButtonElement | HTMLInputElement).disabled = true;
  }
}

function main(): void {
  // ── state + persistence ──
  const persist = createPersistence(storageOrNull());
  const settings = createStore<Settings>(persist.loadSettings());
  const app = createStore<AppState>({ ...DEFAULT_APP_STATE });

  const saveSettings = debounced(persist.saveSettings);
  settings.subscribe((s) => saveSettings.push(s));
  addEventListener('pagehide', () => saveSettings.flush());
  // pagehide is unreliable on mobile (tab switched away, then killed): flush on hide too
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveSettings.flush();
  });

  // ── audio ──
  const supported = NoiseEngine.isSupported();
  const engine = supported ? new NoiseEngine() : null;
  if (engine) bindEngine(settings, engine);
  else disableAudioControls();

  // ── UI ──
  mountColors(settings);
  mountSound(settings);
  mountTransport({ settings, app, engine: engine ?? silentEngine });
}

main();
```

## Appendix F: `persist.test.ts` rewrite

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './defaults';
import { createPersistence } from './persist';

function memory(init: Record<string, string> = {}) {
  const data = new Map(Object.entries(init));
  return {
    data,
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
}

const LEGACY_CONFIG = '{"type":"brown","volume":70,"pan":-20}';

describe('persistence', () => {
  it('migrates the legacy config once', () => {
    const m = memory({ 'noise-app-config': LEGACY_CONFIG });
    const p = createPersistence(m);
    const s = p.loadSettings();
    expect([s.type, s.volume, s.pan]).toEqual(['brown', 70, -20]);
    expect(m.data.has('noisehue:settings')).toBe(true);
    expect(m.data.get('noise-app-config')).toBe(LEGACY_CONFIG);
    m.data.set('noise-app-config', '{"type":"blue","volume":10}');
    expect(p.loadSettings().type).toBe('brown');
    expect(p.loadSettings().volume).toBe(70);
  });

  it('round-trips and sanitizes stored values', () => {
    const m = memory();
    const p = createPersistence(m);
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
    p.saveSettings({ ...DEFAULT_SETTINGS, type: 'violet', volume: 12 });
    expect(p.loadSettings().type).toBe('violet');
    m.data.set('noisehue:settings', '{not json');
    expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores old ui/preset keys and tolerates throwing storage', () => {
    const m = memory({ 'noisehue:ui': '{not json', 'noisehue:presets': 'junk' });
    expect(createPersistence(m).loadSettings()).toEqual(DEFAULT_SETTINGS);
    const boom = () => {
      throw new Error('denied');
    };
    for (const storage of [{ getItem: boom, setItem: boom }, null]) {
      const p = createPersistence(storage);
      expect(p.loadSettings()).toEqual(DEFAULT_SETTINGS);
      expect(() => p.saveSettings(DEFAULT_SETTINGS)).not.toThrow();
    }
  });
});
```
