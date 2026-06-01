# SmartEVSE Deluxe UI

A modern web interface for the [SmartEVSE V3](https://github.com/dingo35/SmartEVSE-3.5)
EV charger — a Vue 3 rewrite of the device's stock `index.html`. It polls the
controller's `/settings` endpoint and renders a live dashboard, the LCD stream,
and the full set of controls (mode, solar, locks, PWM, MQTT, OCPP, …).

Built with **Vue 3** · **Vite** · **Tailwind CSS v4** · **TypeScript** ·
**Pinia** · **Vue Router**.

## Why this exists

The SmartEVSE V3 ships its own web UI — a single `index.html` built on jQuery and
Bootstrap, served straight off the device's flash. It works, but it's awkward to
develop:

- **The edit/see loop runs through the device.** To check how a UI change looks or
  behaves, you flash `index.html` to the controller and reload — there's no local
  preview, no hot reload, and every iteration is gated on a firmware/file upload.
- **It's stuck in an older stack.** Hand-written jQuery DOM manipulation and
  Bootstrap, with no components, types, or build step.

This project reimplements that UI in a **modern frontend stack** so the inner loop
is fast and the code is maintainable:

- **Instant hot reload** via the Vite dev server (or the mock device / dev proxy) —
  you see changes in the browser immediately, no flashing.
- **Component-based, typed code** — Vue 3 single-file components, TypeScript
  against the device's `/settings` contract, Tailwind for styling, Pinia for state.
- **Decoupled from the firmware** — the app talks to the device over its existing
  HTTP/WebSocket API and can run anywhere (locally, in a container, or hosted
  separately), so the device firmware never has to change to iterate on the UI.

It mirrors the stock UI's behaviour (the same endpoints, write semantics, and LCD
WebSocket protocol) while being a clean rewrite, not a port.

## How it works

The app is a **single-page client** for the SmartEVSE V3's built-in HTTP server.
It holds no backend of its own — the device is the only source of truth.

- **Poll / commit loop.** A single Pinia store ([`src/stores/evse.ts`](src/stores/evse.ts))
  polls `GET /settings` on an interval (default 5s), replacing its state wholesale
  each tick. Writes go out as `POST /settings?key=value` (params in the query
  string, empty body — matching the firmware) and are immediately followed by a
  refresh, so the UI always reflects device truth rather than optimistic state.
  Polling pauses while the tab is hidden and resumes (with an immediate refresh)
  on focus.
- **LCD mirror.** [`src/composables/useLcd.ts`](src/composables/useLcd.ts) opens
  the `/ws/lcd` WebSocket, renders the streamed BMP frames, and sends button
  presses back. It reconnects on host/visibility/online changes.
- **Connection.** The target device is set in the UI (or auto-detected via mDNS
  as `SmartEVSE-<serial>.local`) and persisted to `localStorage`.
- **Cross-origin / CORS.** The firmware sends no CORS headers, so a browser
  loading this app from another origin can't fetch the device by IP directly.
  Every supported deployment puts the app on the **same origin** as the device
  traffic — by serving it from the device, from a Caddy reverse proxy, or via the
  Vite dev proxy (see the [table below](#why-cors-matters-here)).
- **Relocatable bundle.** Built with a relative asset base (`base: './'`) and
  hash-based routing, so `dist/` works under any mount path with no SPA-fallback
  config.

## Features

- **Live dashboard** — EVSE status, EV state (SoC / ETA), current details, mains
  & EV-meter phase currents, EV meter energy, home battery. Cards appear only
  when the device reports the relevant section.
- **Live LCD** — streams the device's screen over WebSocket with Left/Middle/Right
  button control and PIN unlock.
- **Controls** — mode (OFF/PAUSE/NORMAL/SOLAR/SMART), delayed start/stop schedule,
  override current, solar settings, LCD/cable locks, PWM override, autocharge
  (required EVCCID), reboot, firmware update, raw JSON view.
- **Config** — MQTT and OCPP settings with live status.
- **Connection** — set the device address in the UI or **auto-detect via mDNS**
  (`SmartEVSE-<serial>.local`). Polling interval defaults to 5s; pause/resume and
  the chosen device persist across reloads.

## Quick start (development)

```bash
npm install
npm run dev
```

Then set the device address in the **Connection** panel (top-right gear), or run
against the bundled mock so you don't need hardware:

```bash
npm run mock          # mock SmartEVSE on http://localhost:8080 (CORS enabled)
```

Point the in-app address field at `localhost:8080`, or use the dev proxy
(below) to avoid CORS entirely.

### Dev proxy (real hardware, no CORS)

The firmware sends **no CORS headers**, so a browser loading this app from
`localhost:5173` cannot fetch a device by IP directly. For development, forward
requests through Vite's dev proxy — copy `.env.example` to `.env` and set:

```bash
VITE_DEVICE_HOST=192.168.1.50        # or SmartEVSE-1234.local
```

Then leave the in-app address field **empty**; `npm run dev` proxies `/settings`,
`/reboot`, `/ws/lcd`, … to the device server-side.

## Run with Docker Compose

All Docker commands run from `app/` (where [`docker-compose.yml`](docker-compose.yml)
lives). Two profiles are defined; both put the app and the device on a single
Caddy origin so there's **no CORS and no firmware change**.

| Profile | Command | What you get |
|---|---|---|
| **prod** | `DEVICE_HOST=192.168.1.50 docker compose up` | Builds the SPA once, Caddy serves `dist/` and proxies the device. → `http://localhost:8088` |
| **dev** | `DEVICE_HOST=192.168.1.50 docker compose --profile dev up` | Vite dev server with hot reload behind Caddy. → `http://localhost:5173` |

`prod` is the default profile, so `docker compose up` runs it. The `dev` profile
must be requested explicitly via `--profile dev` (flag) or
`COMPOSE_PROFILES=dev` (env var). Pass `-d` to either to run detached.

In both cases, leave the in-app address field **empty** to use `DEVICE_HOST`, or
type an address to override per request (sent as the `X-Device-Host` header,
which Caddy forwards). `DEVICE_HOST` may be omitted if you'll always set the
address in the UI, though the LCD WebSocket and link navigations still rely on it.

Tear down with `docker compose --profile dev down` (or `down -v` to also drop
the `node_modules` / Caddy volumes and force a clean reinstall).

### Dev profile details (hot reload, Caddy in front)

The `dev` profile runs the Vite dev server in a container. A Caddy reverse
proxy sits in front of Vite — just like prod — serving the app **and** HMR by
proxying the Vite dev server, while forwarding device endpoints to `DEVICE_HOST`.
So the browser hits one origin (no CORS) and edits still hot-reload. The source
tree is bind-mounted; open `http://localhost:5173`.

The first run installs deps into a named volume (`app_node_modules`), so
`localhost:5173` may 502 for a few seconds until Vite is up.

The dev containers use the **host network** (Linux), so requests to the device
go out with the host's LAN IP — not a `172.x` Docker-bridge address the device
refuses. Caddy listens on `:5173` and fronts Vite on `:5174`
(see [`deploy/Caddyfile.dev`](deploy/Caddyfile.dev)).

### Prod profile details (Caddy container)

For hosting the app separately from the device, the `prod` profile runs two
services: a one-shot **builder** (`node:24-alpine`) that runs `npm ci && npm run
build` with `VITE_PROXY_MODE=true` to compile the SPA into `dist/`, and the
official **caddy** image that serves it **and** reverse-proxies the device
endpoints on `:8088`.

- Leave the in-app address field **empty** to use `DEVICE_HOST` (covers the LCD
  WebSocket and link navigations too).
- Or type an address in the UI to override per request: the build sets
  `VITE_PROXY_MODE=true`, so it sends your address as the `X-Device-Host` header
  and Caddy forwards `fetch` requests there. (WebSocket/links still use
  `DEVICE_HOST`, since browsers can't set headers on those.)

See [`docker-compose.yml`](docker-compose.yml) and [`deploy/Caddyfile`](deploy/Caddyfile).

### Why CORS matters here

| Deployment | Browser talks to | CORS? |
|---|---|---|
| Served from the device (flash `dist/`) | the device (same origin) | none |
| Caddy container (this repo) | Caddy (same origin) | none |
| Dev (`npm run dev`) | Vite, which proxies the device | none |
| App by IP → device directly | the device (cross-origin) | **blocked** unless the firmware adds `Access-Control-Allow-Origin` |

The firmware advertises itself over mDNS as **`SmartEVSE-<serialnr>.local`**, which
the OS resolves; "auto-detect" probes that name once the serial is known.

## Configuration (env)

| Variable | Used by | Description |
|---|---|---|
| `VITE_DEVICE_HOST` | dev server | Device the Vite dev proxy forwards to. |
| `VITE_DEFAULT_HOST` | app | Address pre-filled in the connection field. |
| `VITE_POLL_INTERVAL` | app | Poll interval in ms (default `5000`). |
| `VITE_PROXY_MODE` | build | `true` → same-origin requests + `X-Device-Host` header (set by `build:proxy`). |
| `DEVICE_HOST` | Caddy | Default upstream controller for the container. |

## Project structure

```
src/
  lib/         types, fetch/API layer, formatters, mDNS detection
  stores/      Pinia store: connection, polling, write helpers
  composables/ useLcd — LCD WebSocket client
  components/  ui/ (primitives), cards/, control/, config/, AppHeader
  views/       DashboardView, RawDataView
deploy/        Caddyfile, Caddyfile.dev (reverse-proxy configs)
mock/          dependency-free mock SmartEVSE for offline dev
docker-compose.yml   prod + dev profiles (see "Run with Docker Compose")
```

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server. |
| `npm run build` | Type-check + production build to `dist/`. |
| `npm run build:proxy` | Build in proxy mode (for the Caddy container). |
| `npm run preview` | Preview the production build. |
| `npm run type-check` | `vue-tsc` only. |
| `npm run mock` | Run the mock SmartEVSE device. |
