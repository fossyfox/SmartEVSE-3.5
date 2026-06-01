/**
 * Shape of the SmartEVSE `/settings` JSON response.
 *
 * Fields are intentionally permissive (mostly optional) because the firmware
 * only emits sections that are relevant to the current configuration — e.g.
 * `ev_state` only appears with a PLC modem, `mqtt`/`ocpp` only when compiled
 * in. Treat everything as best-effort and guard at the component level.
 */

export interface WifiInfo {
  status?: string
  ssid?: string
  rssi?: number
  bssid?: string
}

export interface EthInfo {
  present?: boolean
  connected?: boolean
  has_ip?: boolean
}

export interface EvseInfo {
  temp?: number
  temp_max?: number
  connected?: boolean
  access?: number
  mode?: number
  /** Load-balancing role: 0 = disabled, 1 = master, >1 = slave node. */
  loadbl?: number
  pwm?: number
  custombutton?: boolean
  solar_stop_timer?: number
  state?: string
  state_id?: number
  last_state_id?: number
  error?: string
  error_id?: number
  rfidreader?: string
  nrofphases?: number
  rfid?: string
}

export interface EvseSettings {
  charge_current?: number
  override_current?: number
  current_min?: number
  current_max?: number
  current_main?: number
  current_max_circuit?: number
  current_max_sum_mains?: number
  max_sum_mains_time?: number
  solar_max_import?: number
  solar_start_current?: number
  solar_stop_time?: number
  enable_C2?: string
  mains_meter?: string
  modem?: string
  starttime?: number
  stoptime?: number
  repeat?: number
  lcdlock?: number
  lock?: number
  cablelock?: number
  ledmode?: number
  capacity_mode?: number
  required_evccid?: string
  intervals?: CapacityInterval[]
}

/**
 * A time-based power-limit interval used by capacity mode "Interval" (2).
 * `start` is minutes past midnight; the limit applies until the next interval
 * (the last interval wraps to the next day). `power` is the cap in watts.
 */
export interface CapacityInterval {
  start: number
  power: number
}

export interface MqttInfo {
  host?: string
  port?: number
  topic_prefix?: string
  username?: string
  password?: string
  password_set?: boolean
  tls?: boolean
  ca_cert?: string
  status?: string
  smartevse_server?: boolean
}

export interface OcppInfo {
  mode?: string
  backend_url?: string
  cb_id?: string
  auth_key?: string
  ca_cert_set?: boolean
  tls_verify?: number
  auto_auth?: string
  auto_auth_idtag?: string
  status?: string
}

export interface HomeBattery {
  current?: number
  last_update?: number
}

export interface PhaseCurrents {
  TOTAL?: number
  L1?: number
  L2?: number
  L3?: number
}

export interface MainsPhaseCurrents extends PhaseCurrents {
  last_data_update?: number
  original_data?: PhaseCurrents
}

export interface EvMeter {
  description?: string
  host?: string
  address?: number
  import_active_power?: number
  total_wh?: number
  charged_wh?: number
  currents?: PhaseCurrents
  import_active_energy?: number
}

export interface MainsMeter {
  host?: string
}

export interface EvState {
  full_soc?: number
  initial_soc?: number
  computed_soc?: number
  time_until_full?: number
  energy_capacity?: number
  energy_request?: number
  evccid?: string
}

export interface RgbColor {
  R: number
  G: number
  B: number
}

export interface Settings {
  version?: string
  serialnr?: number
  mode?: string
  mode_id?: number
  car_connected?: boolean
  wifi?: WifiInfo
  eth?: EthInfo
  evse?: EvseInfo
  settings?: EvseSettings
  mqtt?: MqttInfo
  ocpp?: OcppInfo
  home_battery?: HomeBattery
  ev_meter?: EvMeter
  mains_meter?: MainsMeter
  ev_state?: EvState
  phase_currents?: MainsPhaseCurrents
  backlight?: { timer?: number; status?: string }
  color?: Record<string, RgbColor>
}

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

/** SmartEVSE operating modes, indexed by `mode_id`. */
export const MODE_LABELS = ['OFF', 'NORMAL', 'SOLAR', 'SMART', 'PAUSE'] as const
export type ModeId = 0 | 1 | 2 | 3 | 4
