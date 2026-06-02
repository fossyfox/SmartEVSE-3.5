// In-browser mock of the SmartEVSE HTTP API, used only by the public demo build
// (`--mode demo`). It mirrors the shape served by `mock/device.mjs` but lives in
// the browser so the demo needs no backend at all — see `install.ts`, which wires
// it into a `fetch` interceptor.
//
// The state is mutable and lightly *simulated*: each `/settings` read advances a
// tiny physics-free model (SoC creeps up while charging, currents and power
// jitter, energy accumulates) so the dashboard feels alive, and POSTed writes are
// reflected on the next read just like the real device.
import { MODE_LABELS, type Settings } from '@/lib/types'

// Literal so TS infers concrete (non-optional) types for everything we mutate.
const state = {
  version: 'v4.0.0',
  serialnr: 1234,
  mode: 'NORMAL',
  mode_id: 1,
  car_connected: true,
  wifi: { status: 'WL_CONNECTED', ssid: 'HomeNet', rssi: -52, bssid: 'aa:bb:cc:dd:ee:ff' },
  eth: { present: false, connected: false, has_ip: false },
  evse: {
    temp: 34, temp_max: 65, connected: true, access: 1, mode: 1, loadbl: 0,
    pwm: 512, custombutton: false, solar_stop_timer: 0, state: 'Charging', state_id: 2,
    last_state_id: 2, error: 'None', error_id: 0, rfidreader: 'Disabled', nrofphases: 3,
    rfid: 'Not Installed',
  },
  settings: {
    charge_current: 100, override_current: 0, current_min: 6, current_max: 16,
    current_main: 40, current_max_circuit: 16, current_max_sum_mains: 600,
    solar_max_import: 0, solar_start_current: 4, solar_stop_time: 10,
    enable_C2: 'Always On', mains_meter: 'API', modem: 'Disabled',
    starttime: 0, stoptime: 0, repeat: 0, lcdlock: 0, lock: 1, cablelock: 0, ledmode: 0,
    capacity_mode: 0, required_evccid: '', intervals: [] as { start: number; power: number }[],
  },
  mqtt: {
    host: 'mqtt.local', port: 1883, topic_prefix: 'SmartEVSE-1234', username: 'evse',
    password_set: true, tls: false, status: 'Connected', smartevse_server: false,
  },
  ocpp: {
    mode: 'Enabled', backend_url: 'wss://ocpp.example.com/', cb_id: 'SE-1234', auth_key: '',
    ca_cert_set: true, tls_verify: 1, auto_auth: 'Disabled', auto_auth_idtag: '',
    status: 'Connected (TLS verified)',
  },
  home_battery: { current: -15, last_update: nowSec() },
  ev_meter: {
    description: 'ABB', address: 11, import_active_power: 3700, total_wh: 186960, charged_wh: 4200,
    currents: { TOTAL: 160, L1: 53, L2: 54, L3: 53 }, import_active_energy: 186960,
  },
  mains_meter: { host: '' },
  ev_state: {
    full_soc: 80, initial_soc: 42, computed_soc: 61, time_until_full: 5400,
    energy_capacity: 58000, energy_request: 22000, evccid: 'DE1234567890',
  },
  phase_currents: {
    TOTAL: 95, L1: 32, L2: 31, L3: 32, last_data_update: nowSec(),
    original_data: { TOTAL: 95, L1: 32, L2: 31, L3: 32 },
  },
  backlight: { timer: 0, status: 'ON' },
}

function nowSec(): number {
  return Math.floor(Date.now() / 1000)
}

// Modes that actively draw power: NORMAL (1), SOLAR (2), SMART (3).
function isChargingMode(): boolean {
  return state.car_connected && [1, 2, 3].includes(state.mode_id)
}

// Smooth, seeded-by-time wobble so values drift instead of teleporting.
function wobble(base: number, amp: number, periodMs: number, phase = 0): number {
  return base + amp * Math.sin((Date.now() / periodMs) * Math.PI * 2 + phase)
}

let lastTick = Date.now()

/** Advance the toy simulation by the real elapsed time since the last read. */
function simulate(): void {
  const now = Date.now()
  const dt = Math.min(30, (now - lastTick) / 1000) // clamp long tab-hidden gaps
  lastTick = now

  const charging = isChargingMode()
  const ev = state.ev_state
  const meter = state.ev_meter

  if (charging) {
    state.evse.state = 'Charging'
    state.evse.state_id = 2

    // SoC creeps toward full, then a fresh "session" loops so the demo keeps
    // showing an active charge instead of parking at 80% forever.
    ev.computed_soc = Math.min(ev.full_soc, ev.computed_soc + dt * 0.25)
    if (ev.computed_soc >= ev.full_soc) {
      ev.initial_soc = 38 + Math.round(wobble(4, 4, 999983))
      ev.computed_soc = ev.initial_soc
    }
    const remaining = Math.max(0, ev.full_soc - ev.computed_soc)
    ev.time_until_full = Math.round((remaining / 0.25 / 100) * 100) // ~ seconds left
    ev.energy_request = Math.round((remaining / 100) * ev.energy_capacity)

    meter.import_active_power = Math.round(wobble(3700, 120, 7000))
    const total = Math.round(wobble(160, 6, 5000))
    meter.currents = {
      TOTAL: total,
      L1: Math.round(total / 3 + wobble(0, 2, 4200, 1)),
      L2: Math.round(total / 3 + wobble(0, 2, 4200, 2)),
      L3: Math.round(total / 3 + wobble(0, 2, 4200, 3)),
    }
    const wh = (meter.import_active_power * dt) / 3600
    meter.total_wh = Math.round(meter.total_wh + wh)
    meter.import_active_energy = meter.total_wh
    meter.charged_wh = Math.round(meter.charged_wh + wh)

    const mainsTotal = Math.round(wobble(95, 5, 6500))
    state.phase_currents = {
      TOTAL: mainsTotal,
      L1: Math.round(mainsTotal / 3 + wobble(0, 2, 5200, 1)),
      L2: Math.round(mainsTotal / 3 + wobble(0, 2, 5200, 2)),
      L3: Math.round(mainsTotal / 3 + wobble(0, 2, 5200, 3)),
      last_data_update: nowSec(),
      original_data: { ...state.phase_currents.original_data },
    }
    state.phase_currents.original_data = {
      TOTAL: state.phase_currents.TOTAL,
      L1: state.phase_currents.L1,
      L2: state.phase_currents.L2,
      L3: state.phase_currents.L3,
    }
    state.evse.temp = Math.round(wobble(36, 4, 30000))
  } else {
    state.evse.state = state.mode_id === 4 ? 'Paused' : 'Ready'
    state.evse.state_id = state.mode_id === 4 ? 0 : 1
    meter.import_active_power = 0
    meter.currents = { TOTAL: 0, L1: 0, L2: 0, L3: 0 }
    ev.time_until_full = 0
    state.evse.temp = Math.round(wobble(30, 2, 30000))
  }

  state.home_battery.current = Math.round(wobble(-15, 8, 11000))
  state.home_battery.last_update = nowSec()
}

/** A live `/settings` snapshot (advances the simulation as a side effect). */
export function readSettings(): Settings {
  simulate()
  return state as unknown as Settings
}

/** Apply a `POST /settings?key=value` write, mirroring the firmware's effects. */
export function applyWrite(params: URLSearchParams): void {
  const num = (k: string) => Number(params.get(k))
  const has = (k: string) => params.has(k)

  if (has('mode')) {
    state.mode_id = num('mode')
    state.mode = MODE_LABELS[state.mode_id as 0 | 1 | 2 | 3 | 4] ?? state.mode
    state.evse.mode = state.mode_id
  }
  if (has('override_current')) state.settings.override_current = num('override_current')
  if (has('override_pwm')) {
    const v = num('override_pwm')
    if (v >= 0) state.evse.pwm = v
  }
  if (has('solar_start_current')) state.settings.solar_start_current = num('solar_start_current')
  if (has('solar_max_import')) state.settings.solar_max_import = num('solar_max_import')
  if (has('stop_timer')) state.settings.solar_stop_time = num('stop_timer')
  if (has('cablelock')) state.settings.cablelock = num('cablelock')
  if (has('lcdlock')) state.settings.lcdlock = num('lcdlock')
  if (has('required_evccid')) state.settings.required_evccid = params.get('required_evccid') ?? ''
  if (has('capacity_mode')) state.settings.capacity_mode = num('capacity_mode')
  if (has('current_max_sum_mains')) state.settings.current_max_sum_mains = num('current_max_sum_mains')
  if (has('intervals')) {
    try {
      state.settings.intervals = JSON.parse(params.get('intervals') ?? '[]')
    } catch {
      /* leave intervals unchanged on malformed input */
    }
  }

  // Scheduling: the UI sends datetime-local strings; just acknowledge them.
  if (has('repeat')) state.settings.repeat = num('repeat')

  // MQTT / OCPP config writes.
  if (has('mqtt_update')) {
    const m = state.mqtt
    if (has('mqtt_host')) m.host = params.get('mqtt_host') ?? m.host
    if (has('mqtt_port')) m.port = num('mqtt_port')
    if (has('mqtt_username')) m.username = params.get('mqtt_username') ?? m.username
    if (has('mqtt_password')) m.password_set = Boolean(params.get('mqtt_password'))
    if (has('mqtt_topic_prefix')) m.topic_prefix = params.get('mqtt_topic_prefix') ?? m.topic_prefix
    if (has('mqtt_tls')) m.tls = num('mqtt_tls') === 1
    m.status = 'Connected'
  }
  if (has('ocpp_update')) {
    const o = state.ocpp
    if (has('ocpp_mode')) {
      o.mode = num('ocpp_mode') === 1 ? 'Enabled' : 'Disabled'
      o.status = o.mode === 'Enabled' ? 'Connected (TLS verified)' : 'Disabled'
    }
    if (has('ocpp_auto_auth')) o.auto_auth = num('ocpp_auto_auth') === 1 ? 'Enabled' : 'Disabled'
    if (has('ocpp_backend_url')) o.backend_url = params.get('ocpp_backend_url') ?? o.backend_url
    if (has('ocpp_cb_id')) o.cb_id = params.get('ocpp_cb_id') ?? o.cb_id
    if (has('ocpp_auth_key')) o.auth_key = params.get('ocpp_auth_key') ?? o.auth_key
    if (has('ocpp_tls_verify')) o.tls_verify = num('ocpp_tls_verify')
    if (has('ocpp_auto_auth_idtag')) o.auto_auth_idtag = params.get('ocpp_auto_auth_idtag') ?? o.auto_auth_idtag
  }
}

/** The demo LCD PIN. */
export function verifyPin(pin: string): boolean {
  return pin === '1234'
}

/**
 * Compact view of the live state for the LCD renderer — the values the
 * firmware's GLCD() status screen actually prints (see src/lib/demo/lcd.ts).
 * `amps` is the *set* charge current Balanced[0], which the firmware exposes as
 * settings.charge_current and prints as "x.xA" — not the measured EV current.
 */
export function lcdInfo(): {
  mode: string
  charging: boolean
  amps: number
  power: number
  energyWh: number
  phases: number
} {
  return {
    mode: state.mode,
    charging: isChargingMode(),
    amps: state.settings.charge_current / 10,
    power: state.ev_meter.import_active_power,
    energyWh: state.ev_meter.charged_wh,
    phases: state.evse.nrofphases,
  }
}

// --- simulated firmware auto-update -------------------------------------
const AUTO_UPDATE_SIZE = 1_572_864
let autoUpdate = { active: false, progress: 0 }

export function autoUpdateStart(): { progress: number; size: number } {
  autoUpdate = { active: true, progress: 0 }
  return { progress: 0, size: AUTO_UPDATE_SIZE }
}

export function autoUpdatePoll(): { progress: number; size: number } {
  if (!autoUpdate.active) return { progress: -1, size: AUTO_UPDATE_SIZE }
  autoUpdate.progress += Math.round(AUTO_UPDATE_SIZE / 8)
  if (autoUpdate.progress >= AUTO_UPDATE_SIZE) {
    autoUpdate.active = false
    return { progress: -1, size: AUTO_UPDATE_SIZE }
  }
  return { progress: autoUpdate.progress, size: AUTO_UPDATE_SIZE }
}
