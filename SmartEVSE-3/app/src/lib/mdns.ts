import { fetchSettings, normalizeOrigin } from './api'

/**
 * Browser-based "mDNS detection".
 *
 * JS can't speak mDNS/DNS-SD, but every major OS resolves `*.local` via mDNS
 * (Bonjour / Avahi). SmartEVSE devices advertise `SmartEVSE-<serialnr>.local`,
 * so we probe likely hostnames (plus the page's own origin when served from the
 * device) and return the first that answers `/settings`.
 */

// The reliable serial-based name (`SmartEVSE-<serialnr>.local`) is supplied by
// the caller once the serial is known; these generic guesses cover rare aliases.
export const DEFAULT_CANDIDATES = ['smartevse.local', 'SmartEVSE.local']

export interface DetectResult {
  host: string
  origin: string
}

export interface DetectOptions {
  timeoutMs?: number
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
  const { timeoutMs = 3000 } = options
  const candidates = Array.from(
    new Set([...extra, ...pageHostCandidate(), ...DEFAULT_CANDIDATES].filter(Boolean)),
  )

  const attempts = candidates.map(
    (host) =>
      new Promise<DetectResult>((resolve, reject) => {
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), timeoutMs)
        const origin = normalizeOrigin(host)
        fetchSettings(origin, { signal: controller.signal })
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
