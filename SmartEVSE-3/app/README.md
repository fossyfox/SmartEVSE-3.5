# SmartEVSE Deluxe UI

A modern web interface for the [SmartEVSE V3](https://github.com/dingo35/SmartEVSE-3.5)
EV charger — a Vue 3 rewrite of the device's stock `index.html`. It polls the
controller's `/settings` endpoint and renders a live dashboard, the LCD stream,
and the full set of controls (mode, solar, locks, PWM, MQTT, OCPP, …).

Built with **Vue 3** · **Vite** · **Tailwind CSS v4** · **TypeScript** ·
**Pinia** · **Vue Router**.

## How it ships

The UI is **built into the firmware and served by the SmartEVSE itself**. The
firmware build (`pio run`) runs [`build_app.py`](../build_app.py), which compiles
this app into one self-contained `index.html` and packs it into the device's
flash. The device then serves it at **`/app.html`**, alongside the legacy stock
UI at `/`.

Because the page is served by the device, the browser talks to the **same
origin** — there is no CORS and nothing else to host. Just flash the firmware and
open `http://<device>/app.html`.

For now the two UIs coexist: the legacy page has a **"Try the new UI →"** link to
`/app.html`, and this app has a **"Classic UI"** link back to `/`. The build is
incremental — the UI is only recompiled when its sources change (`FORCE_APP_BUILD=1`
forces it). Compiling the UI needs Node.js; without it the firmware build just
skips it and ships the legacy UI (see
[Building the firmware](../../docs/building_flashing.md)). `SKIP_APP_BUILD=1` skips
it explicitly.

## Why this exists

The stock UI is a single jQuery/Bootstrap `index.html`, with no components,
types, or build step, and every change has to be flashed to the device to preview.
This project reimplements it in a modern stack so the inner loop is fast (instant
hot reload in dev) and the code is component-based and typed against the device's
`/settings` contract. It mirrors the stock UI's behaviour — same endpoints, write
semantics, and LCD WebSocket protocol — as a clean rewrite, not a port.

## How it works

A single-page client for the SmartEVSE's built-in HTTP server. It holds no
backend of its own — the device is the only source of truth.

- **Poll / commit loop.** A single Pinia store ([`src/stores/evse.ts`](src/stores/evse.ts))
  polls `GET /settings` on an interval (default 5s), replacing its state wholesale
  each tick. Writes go out as `POST /settings?key=value` (params in the query
  string, empty body — matching the firmware) and are immediately followed by a
  refresh, so the UI reflects device truth rather than optimistic state. Polling
  pauses while the tab is hidden and resumes on focus.
- **LCD mirror.** [`src/composables/useLcd.ts`](src/composables/useLcd.ts) opens
  the `/ws/lcd` WebSocket, renders the streamed BMP frames, and sends button
  presses back. It reconnects on host/visibility/online changes.
- **Connection.** Served from the device, the in-app **Device address** field is
  left empty → requests go same-origin to the device. You can also type an
  address (or auto-detect via mDNS as `SmartEVSE-<serial>.local`); the choice is
  persisted to `localStorage`. Pointing at a device **by IP from another origin**
  is cross-origin and the firmware sends no CORS headers — for that, use dev mode
  (below), whose Vite proxy keeps everything same-origin.
- **Relocatable bundle.** Built with a relative asset base (`base: './'`) and
  hash-based routing, so the single `index.html` works at any path (the device
  serves it at `/app.html`) with no SPA-fallback config.

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

## Development

You only need the device's address on your LAN. Pick whichever fits your setup —
both work the same on **Linux, macOS and Windows** and both solve CORS with
Vite's dev proxy (no firmware change, no Caddy):

### Option A — local tools (Node.js installed)

```bash
npm install
cp .env.example .env       # then set VITE_DEVICE_HOST=<device ip or .local>
npm run dev                # http://localhost:5173, hot reload
```

`VITE_DEVICE_HOST` makes the Vite dev server proxy `/settings`, `/ws/lcd`, … to
the real device, so leave the in-app **Device address** field empty. No hardware?
Run the bundled mock instead:

```bash
npm run mock               # mock SmartEVSE on http://localhost:8080
VITE_DEVICE_HOST=localhost:8080 npm run dev
```

### Option B — Docker (no local tools)

Runs the same Vite dev server in a container — nothing to install but Docker.

```bash
DEVICE_HOST=192.168.1.50 docker compose up   # http://localhost:5173
```

Use the device **IP** (a container can't resolve `*.local`). On Linux you can
swap the port mapping for `network_mode: host` to use a `.local` name — see the
comments in [`docker-compose.yml`](docker-compose.yml). Tear down with
`docker compose down` (add `-v` to also drop the `node_modules` volume).

## Configuration (env)

These only affect `npm run dev`; the production bundle (built into the firmware)
reads none of them. Copy [`.env.example`](.env.example) to `.env`.

| Variable | Description |
|---|---|
| `VITE_DEVICE_HOST` | Device the Vite dev proxy forwards to (IP or `.local`). |
| `VITE_DEFAULT_HOST` | Address pre-filled in the connection field on first load. |
| `VITE_POLL_INTERVAL` | Poll interval in ms (default `5000`). |

## Project structure

```
src/
  lib/         types, fetch/API layer, formatters, mDNS detection
  stores/      Pinia store: connection, polling, write helpers
  composables/ useLcd — LCD WebSocket client
  components/  ui/ (primitives), cards/, control/, config/, AppHeader, AppSidebar
  views/       Dashboard, Stats, Control, Capacity, Mqtt, Ocpp, Firmware
mock/          dependency-free mock SmartEVSE for offline dev
docker-compose.yml   optional dev-only container (see Development → Option B)
```

The firmware build packs `dist/index.html` into the device as `/app.html`
([`build_app.py`](../build_app.py), wired into [`platformio.ini`](../platformio.ini)).

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server (hot reload). |
| `npm run build` | Type-check + production build to `dist/` (hashed assets). |
| `npm run build:singlefile` | Type-check + single self-contained `dist/index.html` (what the firmware packs). |
| `npm run preview` | Preview the production build. |
| `npm run type-check` | `vue-tsc` only. |
| `npm run mock` | Run the mock SmartEVSE device. |

There is no test runner; `vue-tsc` (strict) is the only automated check and
`npm run build` gates on it.
