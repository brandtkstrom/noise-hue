# Noise Hue

A colored-noise player for [noisehue.app](https://noisehue.app). Pick a noise color (white, grey, brown, pink, green, blue, violet, orange), shape it with a few sound options, and listen. The sound is generated live with Web Audio in the browser.

The UI is a minimal, mobile-first single column: color chips, a player card, and the sound options in a closed-by-default `<details>`. No visualiser, presets, sleep timer or animations; the background is a static accent-tinted gradient.

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
styles/app.css        all styles: tokens, base, layout, controls
src/
  main.ts             wiring: persistence, settings + app stores, engine, UI modules
  config.ts           fixed configuration (start type, default volume, volume floor)
  types.ts            shared types
  app/engine-sync.ts  maps settings changes to engine calls
  audio/              Web Audio engine and pure noise generators / filter math
  noise/catalog.ts    the 8 noise colors (names, colors, slopes, descriptions)
  state/              store, defaults, validation, persistence, mappings
  ui/                 DOM modules: dom, app-state, colors, sound, transport
docs/
  superpowers/specs/  design spec
  superpowers/plans/  implementation plans
  prototype/          reference prototype (source for the v1 look and behavior)
  qa-checklist.md     manual QA checklist
```

Tests sit next to the code (`*.test.ts`; `*.dom.test.ts` run under jsdom).

## Docs

- Minimal UI plan: [docs/superpowers/plans/2026-10-14-minimal-ui.md](docs/superpowers/plans/2026-10-14-minimal-ui.md)
- Manual QA checklist: [docs/qa-checklist.md](docs/qa-checklist.md)
- v1 design spec (history): [docs/superpowers/specs/2026-10-13-noisehue-design.md](docs/superpowers/specs/2026-10-13-noisehue-design.md)

## Notes

- Playback is foreground-only. Sound may stop when a phone locks or the tab is suspended.
- Settings are saved in `localStorage` under `noisehue:settings`. If storage is blocked, the app still works with defaults. Data left by the full v1 app (`noisehue:ui`, `noisehue:presets`) is ignored and left untouched.
