# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A modern Vue 3 web UI for the **SmartEVSE V3** EV charger. The device runs the
firmware's HTTP server; this app is a single-page client that polls it for
status and writes configuration back. The built bundle is hosted on an
**external HTTP server** (a separate static host), *not* on the device — so the
in-app host field must point at the device and the browser reaches it
**cross-origin**. The bundle is still emitted as relocatable static files
(relative asset base, hash-based routing — see below) so it works under any
mount path on that host.

The active project lives entirely in **`app/`**. Run all commands from there.

Two root-level files are reference material, not part of the app:
- `index.html` — the firmware's **legacy** single-file jQuery/Bootstrap UI. Read
  it to learn how the device actually behaves (endpoints, write semantics, LCD
  WebSocket protocol). The Vue app reimplements its behaviour.
- `settings.json` — a documented sample of the device's `GET /settings`
  response. This is the de-facto API contract that `app/src/lib/types.ts` mirrors.

## Commands

All from `app/`:

```bash
npm install
npm run dev          # Vite dev server (use a proxy or mock for device data — see below)
npm run build        # vue-tsc --noEmit (type-check) THEN vite build
npm run type-check   # vue-tsc --noEmit only
npm run preview      # serve the production build locally
node mock/device.mjs # dependency-free mock device on http://localhost:8080
```

There is **no test runner and no separate linter** configured. `vue-tsc`
(strict mode, `noUnusedLocals`/`noUnusedParameters`) is the only automated
check; run `npm run type-check` before considering a change done. `npm run
build` gates on it.

### Developing against device data

The browser cannot make cross-origin requests to the device without CORS, so
two patterns exist to supply data in dev:

1. **Vite proxy → real hardware.** Set `VITE_DEVICE_HOST` in `app/.env` (copy
   from `.env.example`), leave the in-app host field **empty**, and the dev
   server forwards `/settings`, `/reboot`, `/ws`, etc. to the device. Proxied
   paths are listed in `vite.config.ts`.
2. **Mock device.** `node mock/device.mjs` serves the sample API with CORS
   headers and mutable state (POSTed writes reflect on the next poll; LCD PIN
   `1234` is accepted). Point at it via the in-UI host field or
   `VITE_DEVICE_HOST=localhost:8080 npm run dev`.

## Architecture

Data flow is a poll/commit loop around one Pinia store. The bundle is served by
an external static host with no app logic; the SmartEVSE device remains the only
data/API backend.

**Device API layer — `src/lib/`**
- `api.ts` — typed `fetch` wrapper. Throws `ApiError` tagged with a `kind`
  (`network` | `http` | `timeout` | `parse`). The key contract: **writes are
  `POST /settings?key=value` with params in the query string and an empty
  body** (`postSettings`), matching the firmware's `$.post()` behaviour — not a
  JSON body. `normalizeOrigin` turns a host field (`192.168.1.50`,
  `smartevse.local:8080`, `https://x/`) into an origin; empty means same-origin
  (relies on the proxy in dev). Because the bundle is served from an external
  host in production, the host field must be set to the device's address there.
- `types.ts` — TypeScript shapes of the `/settings` JSON. Fields are
  **deliberately optional** because the firmware only emits sections relevant to
  the current configuration (e.g. `ev_state` needs a PLC modem; `mqtt`/`ocpp`
  only when compiled in). Guard at the component level. `MODE_LABELS` maps
  `mode_id` → `OFF/NORMAL/SOLAR/SMART/PAUSE`.
- `mdns.ts` — "mDNS" device discovery from the browser. JS can't speak mDNS, so
  it races `fetchSettings` against candidate `*.local` hostnames (the firmware
  advertises `SmartEVSE-<serialnr>.local`) and returns the first to answer.

**State — `src/stores/evse.ts` (single Pinia store, the heart of the app)**
- Holds `host`/`origin`, `ConnectionStatus`, and the current `settings` object.
  `settings` is a `shallowRef` because each poll **replaces it wholesale** —
  deep reactivity would be wasted.
- Polling is a manual `setTimeout` chain (not `setInterval`): it skips work
  while the tab is hidden, aborts the in-flight request on host change, and
  `refreshNow()` is called after writes and on tab refocus.
- **All writes go through `commit(params)`** → POST then immediate refresh, so
  the UI always reflects device truth rather than optimistic local state.
- `host` is persisted to `localStorage`.

**LCD mirror — `src/composables/useLcd.ts`**
- Opens the `/ws/lcd` WebSocket, renders streamed BMP frames as object URLs
  (revoking the previous one each frame), and sends `{button, state}` press
  events. Handles bounded reconnection and reconnects on visibility/online/host
  changes. Derives its `ws(s)://` URL from the store's origin.

**Routing — `src/router/index.ts`**
- Uses `createWebHashHistory` **on purpose**: the static host serving the bundle
  isn't guaranteed to provide an SPA fallback for arbitrary paths, so deep links
  must live in the URL hash. Two lazy routes: `/` (DashboardView) and `/raw`
  (RawDataView).

**UI — `src/components/`**
- `cards/` are read-only status panels driven by the store's `settings`.
- `control/ControlPanel.vue` is the main write surface (mode buttons,
  scheduling, override current). Note conditional visibility logic, e.g.
  SOLAR/SMART modes only show with a mains meter or in a load-balancing setup,
  and load-balancing **slave** nodes hide some controls (`loadbl` field).
- `config/` (MQTT, OCPP) and `ui/` (presentational primitives).

## Conventions

- Vite path alias `@` → `app/src` (configured in both `vite.config.ts` and
  `tsconfig.json`).
- Tailwind CSS v4 via `@tailwindcss/vite` (no `tailwind.config.js`; config is
  CSS-first in `src/style.css`).
- `vite.config.ts` sets `base: './'` so the bundle works under any mount path on
  the external static host — keep asset references relative.
- This is a fresh repo with **no commits yet**.
