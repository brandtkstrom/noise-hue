# Noise Hue

A colored-noise player for [noisehue.app](https://noisehue.app). Pick a noise color (white, grey, brown, pink, green, blue, violet, orange), shape it with a few sound options, and listen. The sound is generated live with Web Audio — no audio files. Plain Vite + TypeScript with vanilla DOM: no UI framework and no runtime dependencies.

## The app

A minimal, mobile-first single column (capped at 32 rem), dark-only, with no animations:

- **Colors** — eight chips with swatches; the selected color's one-line description and spectral slope (`flat · 0 dB/oct`, `−6 dB/oct`, …) are shown below. The selection is the accent everywhere: title dot, play button, sliders, the background gradient's tint, and the favicon.
- **Player** — play/pause, a status line (`Paused`, `Playing · White`, `Muted · …`), mute, and volume (a −40 dB to 0 dB taper; 0% is silence).
- **Sound options**, in a closed-by-default `<details>`:
  - _Tone_: tilt, low cut, high cut.
  - _Space_: panning, stereo width.
  - _Waves_: a slow volume swell (depth and period).
  - Color-specific controls where they apply: brown depth, green center and width, grey hearing adjustment, orange gap width and tuning.
  - Reset to defaults resets volume, mute and every option; it keeps the selected color.

## How it works

Noise is synthesized into looping 8-second stereo buffers with independent channels, so stereo width is real decorrelation. Changing the color crossfades to a fresh buffer; color-specific options rebuild it (debounced); tone, space and wave controls are applied live on the filter graph. Pause fades out and suspends the audio context.

## Requirements

- Node 22 (see `.nvmrc`; Vite needs `^20.19.0 || >=22.12.0`)
- npm

## Setup

```sh
nvm use            # optional, picks Node 22 from .nvmrc
npm install
```

On macOS, if `node_modules` was installed on another system (for example a Linux VM), reinstall it first. Some dev tools ship platform-specific binaries:

```sh
rm -rf node_modules && npm install
```

## Scripts

| Command           | What it does                                                       |
| ----------------- | ------------------------------------------------------------------ |
| `npm run dev`     | Start the Vite dev server with hot reload                          |
| `npm run build`   | Type-check (`tsc --noEmit`) and build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally                                    |
| `npm test`        | Run the Vitest suite once (`npm run test:watch` to watch)          |
| `npm run lint`    | ESLint (typescript-eslint)                                         |
| `npm run format`  | Prettier, writes changes                                           |

`dist/` is a static site; on `main`, CI deploys it to Cloudflare (see [Deploy](#deploy)).

## Deploy

GitHub Actions (`.github/workflows/ci.yml`) runs `npm test`, `npm run lint` and `npm run build` on every pull request and push. On a push to `main` it then deploys `dist/` to a Cloudflare Worker (static assets only, configured in `wrangler.jsonc`).

One-time setup:

1. In the Cloudflare dashboard, go to **Account API tokens** → **Create Token** and use the **Edit Cloudflare Workers** template; scope it to your account.
2. Copy your account ID and add both values as repository secrets (Settings → Secrets and variables → Actions): `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

The first deploy creates the `noisehue` Worker at `https://noisehue.<your-subdomain>.workers.dev`; add `noisehue.app` as a custom domain on the Worker when you are ready. Deploys create immutable Worker versions, so you can roll back from the dashboard or with `npx wrangler rollback`.

## Project structure

```
index.html            static markup for the whole page
public/               favicon.svg (pre-JS default) and favicon.ico (fallback)
styles/app.css        all styles: tokens, base, layout, controls
src/
  main.ts             wiring: persistence, settings + app stores, engine, UI modules
  config.ts           fixed configuration (start type, default volume, volume floor)
  types.ts            shared types
  app/engine-sync.ts  maps settings changes to engine calls
  audio/              Web Audio engine and pure noise generators / filter math
  noise/catalog.ts    the 8 noise colors (names, colors, slopes, descriptions)
  state/              store, defaults, validation, persistence, mappings
  ui/                 DOM modules: dom, app-state, colors, favicon, sound, transport
```

Tests sit next to the code (`*.test.ts`; `*.dom.test.ts` run under jsdom).

## Notes

- Playback is foreground-only: there is no Media Session integration, so sound may stop when a phone locks or the tab is suspended.
- Settings persist to `localStorage` under `noisehue:settings` (writes are debounced and flushed when the page hides). Stored values are sanitized on load, and a legacy `noise-app-config` value is migrated once. If storage is blocked, the app runs on defaults.
