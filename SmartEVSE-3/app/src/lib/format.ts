/**
 * Display formatters mirroring the value conventions used by the SmartEVSE
 * firmware. Many current fields are reported in deci-amps (tenths of an amp).
 */

/** Format a deci-amp value (tenths of an amp) as `12.3 A`. */
export function fmtDeciAmps(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${(value / 10).toFixed(1)} A`
}

/** Format a value already expressed in whole amps as `16.0 A`. */
export function fmtAmps(value: number | undefined | null): string {
  if (value == null || Number.isNaN(value)) return '—'
  return `${value.toFixed(1)} A`
}

/** Format watt-hours as `18.7 kWh`. */
export function fmtKwh(wh: number | undefined | null): string {
  if (wh == null || Number.isNaN(wh)) return '—'
  return `${(wh / 1000).toFixed(1)} kWh`
}

/** Format watts as `3.7 kW`. */
export function fmtKw(w: number | undefined | null): string {
  if (w == null || Number.isNaN(w)) return '—'
  return `${(w / 1000).toFixed(1)} kW`
}

/** Format a state-of-charge percentage, or `N/A` when negative/unknown. */
export function fmtSoc(value: number | undefined | null): string {
  if (value == null || value < 0 || Number.isNaN(value)) return 'N/A'
  return `${value} %`
}

/** EVSE PWM duty cycle: 1024 = 100%. */
export function fmtDutyCycle(pwm: number | undefined | null): string {
  if (pwm == null || Number.isNaN(pwm)) return '—'
  return `${((pwm * 100) / 1024).toFixed(0)} %`
}

/** Format `temp / temp_max` as `34 °C / 65 °C`. */
export function fmtTemp(temp?: number, max?: number): string {
  if (temp == null) return '—'
  const right = max != null ? ` / ${max} °C` : ''
  return `${temp} °C${right}`
}

/** Convert a unix timestamp (seconds) to a localized date+time string. */
export function fmtUnix(seconds: number | undefined | null, fallback = 'none'): string {
  if (!seconds || seconds <= 0) return fallback
  const d = new Date(seconds * 1000)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
}

/** Localized time-only from a unix timestamp (seconds). */
export function fmtUnixTime(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '—'
  return new Date(seconds * 1000).toLocaleTimeString()
}

/** Localized date-only from a unix timestamp (seconds). */
export function fmtUnixDate(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '—'
  return new Date(seconds * 1000).toLocaleDateString()
}

/** "Estimated full at" wall-clock time, computed from seconds-to-go. */
export function fmtEta(secondsUntil: number | undefined | null): string {
  if (!secondsUntil || secondsUntil <= 0) return 'N/A'
  const when = new Date(Date.now() + secondsUntil * 1000)
  return when.toLocaleString(undefined, { timeStyle: 'short', dateStyle: 'short' })
}

/** Relative "x min to go" hint for the ETA tooltip. */
export function fmtMinsToGo(secondsUntil: number | undefined | null): string {
  if (!secondsUntil || secondsUntil <= 0) return 'N/A'
  return `${Math.round(secondsUntil / 60)} min to go`
}

/** Human-readable "x seconds ago" for the last-update indicator. */
export function fmtAgo(timestampMs: number | null): string {
  if (!timestampMs) return 'never'
  const secs = Math.max(0, Math.round((Date.now() - timestampMs) / 1000))
  if (secs < 2) return 'just now'
  if (secs < 60) return `${secs}s ago`
  const mins = Math.round(secs / 60)
  if (mins < 60) return `${mins}m ago`
  return `${Math.round(mins / 60)}h ago`
}
