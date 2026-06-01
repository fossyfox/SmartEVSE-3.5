import type { Settings } from './types'

export class ApiError extends Error {
  constructor(
    message: string,
    readonly kind: 'network' | 'http' | 'timeout' | 'parse',
    readonly status?: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/** Per-call options shared by every request helper. */
export interface CallOptions {
  signal?: AbortSignal
  /** Extra request headers (e.g. `X-Device-Host` when running behind the proxy). */
  headers?: Record<string, string>
  timeoutMs?: number
}

/**
 * Normalize a user-entered host into an origin.
 *
 * - empty           -> '' (same-origin; relies on the proxy or the device itself)
 * - `192.168.1.50`  -> `http://192.168.1.50`
 * - `smartevse.local:8080` -> `http://smartevse.local:8080`
 * - `https://x/`    -> `https://x` (trailing slash stripped)
 */
export function normalizeOrigin(host: string): string {
  const trimmed = host.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `http://${trimmed}`
}

/** Build a fully-qualified URL for a device path against the given origin. */
export function buildUrl(origin: string, path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${origin}${p}`
}

async function request(
  url: string,
  opts: CallOptions & { method?: 'GET' | 'POST'; body?: string; contentType?: string } = {},
): Promise<Response> {
  const { method = 'GET', timeoutMs = 8000, signal, headers, body, contentType } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  if (signal) {
    if (signal.aborted) controller.abort()
    else signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  const finalHeaders: Record<string, string> = { ...headers }
  if (contentType) finalHeaders['Content-Type'] = contentType
  try {
    return await fetch(url, {
      method,
      cache: 'no-store',
      signal: controller.signal,
      headers: finalHeaders,
      body,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(`Request timed out after ${timeoutMs}ms`, 'timeout')
    }
    throw new ApiError((err as Error)?.message || 'Network error', 'network')
  } finally {
    clearTimeout(timer)
  }
}

/** Fetch and parse `/settings`. */
export async function fetchSettings(origin: string, opts: CallOptions = {}): Promise<Settings> {
  const res = await request(buildUrl(origin, '/settings'), opts)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
  try {
    return (await res.json()) as Settings
  } catch {
    throw new ApiError('Response was not valid JSON', 'parse')
  }
}

/** Fetch the raw `/settings` text (for the raw-data view, no parsing). */
export async function fetchSettingsRaw(origin: string, opts: CallOptions = {}): Promise<string> {
  const res = await request(buildUrl(origin, '/settings'), opts)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
  return res.text()
}

/**
 * POST settings as a query string, matching the firmware's
 * `$.post("/settings?key=value")` contract (empty body, params in the URL).
 */
export async function postSettings(
  origin: string,
  params: Record<string, string | number>,
  opts: CallOptions = {},
): Promise<void> {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) qs.append(k, String(v))
  const res = await request(buildUrl(origin, `/settings?${qs.toString()}`), {
    ...opts,
    method: 'POST',
  })
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
}

/** GET a plain-text endpoint (used for `/mqtt_ca_cert`, `/ocpp_ca_cert`, `/reboot`). */
export async function getText(origin: string, path: string, opts: CallOptions = {}): Promise<string> {
  const res = await request(buildUrl(origin, path), opts)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
  return res.text()
}

/** Progress payload returned by the firmware's `/autoupdate` endpoint. */
export interface AutoUpdateProgress {
  /** Bytes flashed so far, or `-1` (success / pending reboot) or `-2` (failure). */
  progress: number
  /** Total firmware size in bytes. */
  size: number
}

/**
 * Trigger a channel auto-update (`GET /autoupdate?owner=&debug=`) or poll its
 * progress (`GET /autoupdate` with no params). The firmware streams the new
 * image from GitHub and reports byte progress on subsequent polls.
 */
export async function fetchAutoUpdate(
  origin: string,
  params: { owner?: string; debug?: 0 | 1 } = {},
  opts: CallOptions = {},
): Promise<AutoUpdateProgress> {
  const qs = new URLSearchParams()
  if (params.owner != null) qs.append('owner', params.owner)
  if (params.debug != null) qs.append('debug', String(params.debug))
  const suffix = qs.toString() ? `?${qs.toString()}` : ''
  const res = await request(buildUrl(origin, `/autoupdate${suffix}`), opts)
  if (!res.ok) throw new ApiError(`HTTP ${res.status}`, 'http', res.status)
  try {
    return (await res.json()) as AutoUpdateProgress
  } catch {
    throw new ApiError('Response was not valid JSON', 'parse')
  }
}

/**
 * Upload one chunk of a file to the firmware's chunked uploader
 * (`POST /update?offset=&file=&size=` with the raw bytes as the body).
 * Resolves with the response text (an error message when `res.ok` is false).
 */
export async function postUpdateChunk(
  origin: string,
  args: { offset: number; file: string; size: number; chunk: Uint8Array },
  opts: CallOptions = {},
): Promise<{ ok: boolean; text: string }> {
  const qs = new URLSearchParams({
    offset: String(args.offset),
    file: args.file,
    size: String(args.size),
  })
  // Send the raw bytes; copy into a fresh ArrayBuffer so a subarray view doesn't
  // leak the rest of the file into the request body.
  const body = args.chunk.slice().buffer
  const res = await request(buildUrl(origin, `/update?${qs.toString()}`), {
    ...opts,
    method: 'POST',
    // Cast: request() types body as string, but fetch accepts a BufferSource.
    body: body as unknown as string,
  })
  return { ok: res.ok, text: await res.text() }
}

/** POST a form-encoded body (used for `/lcd-verify-password`). */
export async function postForm(
  origin: string,
  path: string,
  body: Record<string, string>,
  opts: CallOptions = {},
): Promise<Response> {
  return request(buildUrl(origin, path), {
    ...opts,
    method: 'POST',
    body: new URLSearchParams(body).toString(),
    contentType: 'application/x-www-form-urlencoded',
  })
}
