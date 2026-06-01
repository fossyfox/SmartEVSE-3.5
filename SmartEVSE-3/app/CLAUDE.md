# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modern Vue 3 web UI for the **SmartEVSE V3** EV charger. The device runs the
firmware's HTTP server; this app is a single-page client that polls it for status
and writes configuration back.

It ships **inside the firmware**: the firmware build compiles this app into one
self-contained `index.html` and packs it into the device's flash, which serves it
at **`/app.html`**. So in production the page is served by the device and the
browser talks to it **same-origin** — no CORS, no separate host, no proxy. The
bundle is still relocatable (relative asset base, hash-based routing — see below)
so the single file works at any path.

The legacy stock UI still lives at `/`; the two are linked both ways (a "Try the
new UI →" link on the old page, a "Classic UI" link here) while the new UI is
opt-in.

The active project lives entirely in **`app/`**. Run all commands from there.

To learn how the device actually behaves (endpoints, write semantics, LCD
WebSocket protocol), read the firmware's legacy single-file jQuery/Bootstrap UI
at **`../data/index.html`** — this app reimplements its behaviour. The `/settings`
JSON shape is mirrored in `src/lib/types.ts`.

## Commands

All from `app/`:

```bash
npm install
npm run dev               # Vite dev server (set VITE_DEVICE_HOST or use the mock — see below)
npm run build             # vue-tsc --noEmit (type-check) THEN vite build (hashed assets)
npm run build:singlefile  # type-check THEN one self-contained dist/index.html (what the firmware packs)
npm run type-check        # vue-tsc --noEmit only
npm run preview           # serve the production build locally
npm run mock              # dependency-free mock device on http://localhost:8080
```

There is **no test runner and no separate linter**. `vue-tsc` (strict,
`noUnusedLocals`/`noUnusedParameters`) is the only automated check; run
`npm run type-check` before considering a change done. `npm run build` gates on it.

## How it's built into the firmware

- [`../build_app.py`](../build_app.py) is a PlatformIO `pre:` hook (wired into
  [`../platformio.ini`](../platformio.ini) for the `release` and `v4` envs). It
  runs `npm ci` (first build) + `npm run build:singlefile`, then copies
  `dist/index.html` → `../data/app.html` (and `dist/favicon.svg` → `../data/favicon.svg`).
- `packfs.py` then gzips everything under `../data/` into the flash image, so the
  device serves `/app.html`. `data/app.html` and `data/favicon.svg` are build
  artifacts (git-ignored).
- The firmware build therefore needs **Node.js + npm**. `SKIP_APP_BUILD=1` skips
  the app build and ships only the legacy UI.
- Scripts must stay cross-platform (Linux/macOS/Windows): use Vite's
  `--mode singlefile` rather than an env-var prefix in npm scripts.

## Developing against device data

In dev the app is *not* served by the device, so the browser would hit it
cross-origin. Vite's dev proxy keeps everything same-origin instead (no CORS, no
firmware change). Two ways to supply data, both cross-platform:

1. **Vite proxy → real hardware.** Set `VITE_DEVICE_HOST` in `.env` (copy from
   `.env.example`), leave the in-app host field **empty**, and the dev server
   forwards `/settings`, `/reboot`, `/ws`, etc. to the device. Proxied paths are
   listed in `vite.config.ts`. `docker compose up` (with `DEVICE_HOST=<ip>`) runs
   exactly this in a container for people without local Node.
2. **Mock device.** `npm run mock` serves the sample API with CORS headers and
   mutable state (POSTed writes reflect on the next poll; LCD PIN `1234`). Reach
   it via the in-UI host field or `VITE_DEVICE_HOST=localhost:8080 npm run dev`.

## Architecture

Data flow is a poll/commit loop around one Pinia store. The SmartEVSE device is
the only data/API backend.

**Device API layer — `src/lib/`**
- `api.ts` — typed `fetch` wrapper. Throws `ApiError` tagged with a `kind`
  (`network` | `http` | `timeout` | `parse`). Key contract: **writes are
  `POST /settings?key=value` with params in the query string and an empty body**
  (`postSettings`), matching the firmware's `$.post()` behaviour — not a JSON
  body. `normalizeOrigin` turns a host field into an origin; **empty means
  same-origin** (the device when served off its flash; the Vite proxy in dev).
- `types.ts` — TypeScript shapes of the `/settings` JSON. Fields are
  **deliberately optional** because the firmware only emits sections relevant to
  the current configuration (e.g. `ev_state` needs a PLC modem; `mqtt`/`ocpp` only
  when compiled in). Guard at the component level. `MODE_LABELS` maps `mode_id` →
  `OFF/NORMAL/SOLAR/SMART/PAUSE`.
- `mdns.ts` — browser "mDNS" discovery. JS can't speak mDNS, so it races
  `fetchSettings` against candidate `*.local` hostnames (the firmware advertises
  `SmartEVSE-<serialnr>.local`, plus the page's own origin) and returns the first
  to answer.

**State — `src/stores/evse.ts` (single Pinia store, the heart of the app)**
- Holds `host`/`origin`, `ConnectionStatus`, and the current `settings` object.
  `settings` is a `shallowRef` because each poll **replaces it wholesale**.
- `origin` is just `normalizeOrigin(host)` — empty host → same-origin → the device.
- Polling is a manual `setTimeout` chain (not `setInterval`): it skips work while
  the tab is hidden, aborts the in-flight request on host change, and
  `refreshNow()` runs after writes and on tab refocus.
- **All writes go through `commit(params)`** → POST then immediate refresh.
- `host` is persisted to `localStorage`.

**LCD mirror — `src/composables/useLcd.ts`**
- Opens the `/ws/lcd` WebSocket, renders streamed BMP frames as object URLs
  (revoking the previous one each frame), and sends `{button, state}` press
  events. Handles bounded reconnection on visibility/online/host changes. Derives
  its `ws(s)://` URL from the store's origin.

**Routing — `src/router/index.ts`**
- Uses `createWebHashHistory` **on purpose**: the device has no SPA fallback for
  arbitrary paths, so deep links must live in the URL hash. Lazy routes for
  dashboard, stats, control, capacity, mqtt, ocpp, firmware.

**UI — `src/components/`**
- `cards/` are read-only status panels driven by the store's `settings`.
- `control/ControlPanel.vue` is the main write surface (mode buttons, scheduling,
  override current). Note conditional visibility, e.g. SOLAR/SMART modes only show
  with a mains meter or load-balancing setup, and load-balancing **slave** nodes
  hide some controls (`loadbl` field).
- `config/` (MQTT, OCPP) and `ui/` (presentational primitives). `AppSidebar.vue`
  holds nav + the "Classic UI" link back to the legacy page.

## Conventions

- Vite path alias `@` → `app/src` (configured in both `vite.config.ts` and
  `tsconfig.json`).
- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`; config is
  CSS-first in `src/style.css`).
- `vite.config.ts` sets `base: './'` so the single bundle works at any mount path
  on the device — keep asset references relative.
