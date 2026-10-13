# Noise Hue

A colored-noise player for [noisehue.app](https://noisehue.app). Pick a noise color (white, grey, brown, pink, green, blue, violet, orange), shape it with a few sound options, and listen, with a sleep timer and saved presets. The sound is generated live with Web Audio in the browser.

Plain Vite + TypeScript with vanilla DOM: no UI framework and no runtime dependencies.

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

`dist/` is a static site and can be deployed to any static host.

## Project structure

```
index.html            static markup for the whole page
styles/               tokens.css, layout.css, components.css
src/
  main.ts             wiring: persistence, stores, engine, UI modules, viz loop
  config.ts           fixed configuration (former prototype tweaks)
  types.ts            shared types
  app/engine-sync.ts  maps settings changes to engine calls
  audio/              Web Audio engine and pure noise generators / filter math
  noise/catalog.ts    the 8 noise colors (names, colors, slopes, descriptions)
  state/              store, defaults, validation, persistence, mappings, sleep timer, presets
  ui/                 DOM modules: panels, colors, sound, presets, transport, timer popover, viz
  viz/                pure waveform / compare-curve and background builders
docs/
  superpowers/specs/  design spec
  prototype/          reference prototype (source of truth for look and behavior)
  qa-checklist.md     manual QA checklist
```

Tests sit next to the code (`*.test.ts`; `*.dom.test.ts` run under jsdom).

## Docs

- Design spec: [docs/superpowers/specs/2026-10-13-noisehue-design.md](docs/superpowers/specs/2026-10-13-noisehue-design.md)
- Manual QA checklist: [docs/qa-checklist.md](docs/qa-checklist.md)

## Notes

- Playback is foreground-only. Sound may stop when a phone locks or the tab is suspended.
- Settings, panel layout and presets are saved in `localStorage` (`noisehue:settings`, `noisehue:ui`, `noisehue:presets`). If storage is blocked, the app still works with defaults.
