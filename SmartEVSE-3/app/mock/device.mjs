// Minimal dependency-free mock of the SmartEVSE HTTP API for offline UI dev.
//
//   node mock/device.mjs            # listens on http://localhost:8080
//   PORT=9000 node mock/device.mjs
//
// Point the app at it either via the in-UI host field (CORS headers are sent)
// or via the dev proxy: `VITE_DEVICE_HOST=localhost:8080 npm run dev`.
import { createServer } from 'node:http'

const PORT = Number(process.env.PORT) || 8080

// Mutable state so POSTed settings visibly change on the next poll.
const state = {
  version: 'v3.6.2',
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
    current_main: 40, current_max_circuit: 16, solar_max_import: 0, solar_start_current: 4,
    solar_stop_time: 10, enable_C2: 'Always On', mains_meter: 'API', modem: 'Disabled',
    starttime: 0, stoptime: 0, repeat: 0, lcdlock: 0, lock: 1, cablelock: 0, ledmode: 0,
    capacity_mode: 0, required_evccid: '', intervals: [],
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
  home_battery: { current: -15, last_update: Math.floor(Date.now() / 1000) },
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
    TOTAL: 95, L1: 32, L2: 31, L3: 32, last_data_update: Math.floor(Date.now() / 1000),
    original_data: { TOTAL: 95, L1: 32, L2: 31, L3: 32 },
  },
  backlight: { timer: 0, status: 'ON' },
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(typeof body === 'string' ? body : JSON.stringify(body))
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`)
  if (req.method === 'OPTIONS') return send(res, 204, '')

  if (url.pathname === '/settings') {
    if (req.method === 'POST') {
      const params = Object.fromEntries(url.searchParams.entries())
      console.log('POST /settings', params)
      // Reflect a few common writes so the UI updates visibly.
      if ('mode' in params) {
        state.mode_id = Number(params.mode)
        state.mode = ['OFF', 'NORMAL', 'SOLAR', 'SMART', 'PAUSE'][state.mode_id] ?? state.mode
      }
      if ('lcdlock' in params) state.settings.lcdlock = Number(params.lcdlock)
      if ('cablelock' in params) state.settings.cablelock = Number(params.cablelock)
      if ('required_evccid' in params) state.settings.required_evccid = params.required_evccid
      return send(res, 200, { success: true })
    }
    return send(res, 200, state)
  }

  if (url.pathname === '/reboot') return send(res, 200, 'Rebooting...', 'text/plain')
  if (url.pathname === '/mqtt_ca_cert') return send(res, 200, '-----BEGIN CERTIFICATE-----\n(mock)\n-----END CERTIFICATE-----', 'text/plain')
  if (url.pathname === '/ocpp_ca_cert') return send(res, 200, '-----BEGIN CERTIFICATE-----\n(mock)\n-----END CERTIFICATE-----', 'text/plain')
  if (url.pathname === '/lcd-verify-password') {
    // Accept PIN 1234 in the mock.
    return send(res, 200, { success: true })
  }

  send(res, 404, { error: 'not found' })
}).listen(PORT, () => console.log(`Mock SmartEVSE on http://localhost:${PORT}`))
