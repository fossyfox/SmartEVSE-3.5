import { fetchSettings, normalizeOrigin } from './api'

/**
 * Browser-based "mDNS detection".
 *
 * Browsers cannot speak mDNS/DNS-SD directly from JavaScript, but every major
 * OS resolves `*.local` hostnames via mDNS (Bonjour / Avahi). SmartEVSE devices
 * advertise themselves as `SmartEVSE-<serialnr>.local`, so we probe a list of
 * likely hostnames (plus the page's own origin when it is served from the
 * device) and return the first that answers `/settings`.
 */

// The firmware's real mDNS name is `SmartEVSE-<serialnr>.local`, so the most
// reliable candidate (the serial-based name) is supplied by the caller once the
// serial is known. These generic guesses cover the rare aliased setups.
export const DEFAULT_CANDIDATES = ['smartevse.local', 'SmartEVSE.local']

export interface DetectResult {
  host: string
  origin: string
}

export interface DetectOptions {
  timeoutMs?: number
  /**
   * When set (including `''`), probe candidates *through* this proxy origin by
   * sending each candidate as an `X-Device-Host` header, instead of hitting the
   * device cross-origin. Used in proxy mode to avoid browser CORS.
   */
  proxyBase?: string | null
}

function pageHostCandidate(): string[] {
  if (typeof window === 'undefined') return []
  const h = window.location.hostname
  if (!h || h === 'localhost' || h === '127.0.0.1') return []
  return [h]
}

/**
 * Probe candidate hosts in parallel and resolve with the first reachable one.
 *
 * @param extra  Additional candidate hosts to try first (e.g. a remembered host).
 */
export async function detectDevice(
  extra: string[] = [],
  options: DetectOptions = {},
): Promise<DetectResult> {
  const { timeoutMs = 3000, proxyBase = null } = options
  const candidates = Array.from(
    new Set([...extra, ...pageHostCandidate(), ...DEFAULT_CANDIDATES].filter(Boolean)),
  )

  const attempts = candidates.map(
    (host) =>
      new Promise<DetectResult>((resolve, reject) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const origin = proxyBase !== null ? proxyBase : normalizeOrigin(host)
        const headers = proxyBase !== null ? { 'X-Device-Host': host } : undefined
        fetchSettings(origin, { signal: controller.signal, headers })
          .then(() => resolve({ host, origin }))
          .catch((err) => reject(err))
          .finally(() => clearTimeout(timer))
      }),
  )

  if (attempts.length === 0) {
    throw new Error('No candidate hosts to probe')
  }

  // Resolve with the first candidate that succeeds; only reject once all fail.
  return Promise.any(attempts).catch(() => {
    throw new Error(`No SmartEVSE found at: ${candidates.join(', ')}`)
  })
}
