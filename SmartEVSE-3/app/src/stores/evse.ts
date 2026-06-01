import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import {
  ApiError,
  fetchAutoUpdate,
  fetchSettings,
  getText,
  normalizeOrigin,
  postForm,
  postSettings,
  postUpdateChunk,
  type AutoUpdateProgress,
  type CallOptions,
} from '@/lib/api'
import type { ConnectionStatus, Settings } from '@/lib/types'

const HOST_STORAGE_KEY = 'smartevse.host'
const POLL_PAUSED_STORAGE_KEY = 'smartevse.pollPaused'
const DEFAULT_POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL) || 5000

function loadStoredHost(): string {
  try {
    const stored = localStorage.getItem(HOST_STORAGE_KEY)
    if (stored != null) return stored
  } catch {
    /* storage unavailable */
  }
  return import.meta.env.VITE_DEFAULT_HOST ?? ''
}

function loadStoredPollPaused(): boolean {
  try {
    return localStorage.getItem(POLL_PAUSED_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export const useEvseStore = defineStore('evse', () => {
  // --- connection ---------------------------------------------------------
  const host = ref<string>(loadStoredHost())
  const status = ref<ConnectionStatus>('idle')
  const lastError = ref<string | null>(null)
  const lastUpdated = ref<number | null>(null)

  // --- data ---------------------------------------------------------------
  // shallowRef: settings is replaced wholesale each poll, so deep reactivity
  // would be wasted work.
  const settings = shallowRef<Settings | null>(null)

  // --- polling ------------------------------------------------------------
  const pollIntervalMs = ref(DEFAULT_POLL_MS)
  const polling = ref(false)
  // Persisted user intent to suspend polling; distinct from `polling` (runtime
  // loop flag) so stopPolling() teardown doesn't clobber the saved preference.
  const pollingPaused = ref(loadStoredPollPaused())
  let pollTimer: ReturnType<typeof setTimeout> | null = null
  let inFlight: AbortController | null = null

  // The Vite dev proxy forwards same-origin requests to VITE_DEVICE_HOST, so the
  // browser never talks cross-origin to the device (which sends no CORS headers).
  // The proxy only exists under `vite dev`; a production build is served by the
  // device same-origin, so VITE_DEVICE_HOST is irrelevant there even if it leaked
  // into the bundle from `.env`. Gate on import.meta.env.DEV so prod ignores it.
  const DEV_PROXY_HOST = import.meta.env.DEV ? (import.meta.env.VITE_DEVICE_HOST ?? '').trim() : ''

  // Empty host = same origin (the device when served off its flash; the Vite
  // proxy in dev). A non-empty host talks straight to that origin — EXCEPT in
  // dev, where pointing at the proxy target must resolve to same-origin so Vite
  // forwards it, rather than the browser hitting the device cross-origin (CORS).
  const origin = computed(() => {
    const resolved = normalizeOrigin(host.value)
    if (DEV_PROXY_HOST && resolved === normalizeOrigin(DEV_PROXY_HOST)) return ''
    return resolved
  })

  // WebSocket URL for the LCD mirror, derived from the request origin.
  const lcdWsUrl = computed(() => {
    const base = origin.value
    if (!base) {
      const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
      return `${proto}//${location.host}/ws/lcd`
    }
    return `${base.replace(/^http/, 'ws')}/ws/lcd`
  })
  const displayHost = computed(() => {
    // origin === '' means "same origin": the device's own flash in prod, or the
    // Vite proxy in dev (host field empty OR set to the proxy target).
    if (origin.value) return host.value
    if (DEV_PROXY_HOST) return `${DEV_PROXY_HOST} (via dev proxy)`
    return `${location.host} (same origin)`
  })

  function describeError(err: unknown): string {
    if (err instanceof ApiError) {
      switch (err.kind) {
        case 'timeout':
          return 'Device did not respond in time.'
        case 'http':
          return `Device returned HTTP ${err.status}.`
        case 'parse':
          return 'Device response was not valid JSON.'
        default:
          return host.value
            ? `Could not reach ${host.value}. Check the address — and note that cross-origin requests require CORS support on the device.`
            : 'Could not reach the device.'
      }
    }
    return err instanceof Error ? err.message : 'Unknown error'
  }

  async function refresh(): Promise<void> {
    inFlight?.abort()
    inFlight = new AbortController()
    if (!settings.value) status.value = 'connecting'
    try {
      const data = await fetchSettings(origin.value, { signal: inFlight.signal })
      settings.value = data
      status.value = 'connected'
      lastError.value = null
      lastUpdated.value = Date.now()
    } catch (err) {
      if (inFlight.signal.aborted) return
      status.value = 'error'
      lastError.value = describeError(err)
    }
  }

  function scheduleNext(): void {
    if (!polling.value) return
    pollTimer = setTimeout(async () => {
      if (!polling.value) return
      // Skip work while the tab is hidden; resume on visibilitychange.
      if (typeof document !== 'undefined' && document.hidden) {
        scheduleNext()
        return
      }
      await refresh()
      scheduleNext()
    }, pollIntervalMs.value)
  }

  function startPolling(): void {
    if (polling.value) return
    // Honour a persisted pause across mounts/reloads.
    if (pollingPaused.value) return
    polling.value = true
    void refresh().then(scheduleNext)
  }

  function stopPolling(): void {
    polling.value = false
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    inFlight?.abort()
  }

  /** Suspend auto-polling and remember the choice. */
  function pausePolling(): void {
    pollingPaused.value = true
    try {
      localStorage.setItem(POLL_PAUSED_STORAGE_KEY, '1')
    } catch {
      /* ignore */
    }
    stopPolling()
  }

  /** Clear the paused preference and restart the poll loop. */
  function resumePolling(): void {
    pollingPaused.value = false
    try {
      localStorage.setItem(POLL_PAUSED_STORAGE_KEY, '0')
    } catch {
      /* ignore */
    }
    startPolling()
  }

  /** Refresh immediately (e.g. after a control action or tab regaining focus). */
  async function refreshNow(): Promise<void> {
    if (pollTimer) {
      clearTimeout(pollTimer)
      pollTimer = null
    }
    await refresh()
    scheduleNext()
  }

  // --- write helpers ------------------------------------------------------
  /** POST settings params, then refresh so the UI reflects the device truth. */
  async function commit(params: Record<string, string | number>): Promise<void> {
    await postSettings(origin.value, params)
    await refreshNow()
  }

  async function reboot(): Promise<string> {
    return getText(origin.value, '/reboot')
  }

  async function getMqttCaCert(): Promise<string> {
    return getText(origin.value, '/mqtt_ca_cert')
  }

  async function getOcppCaCert(): Promise<string> {
    return getText(origin.value, '/ocpp_ca_cert')
  }

  async function verifyLcdPin(pin: string): Promise<boolean> {
    const res = await postForm(origin.value, '/lcd-verify-password', { password: pin })
    if (!res.ok) return false
    try {
      const data = (await res.json()) as { success?: boolean }
      return Boolean(data.success)
    } catch {
      return false
    }
  }

  // --- firmware update ----------------------------------------------------
  // Firmware ops are far slower than settings reads: the device erases/writes
  // flash and (for auto-update) downloads the image from GitHub before
  // answering, well past the default 8 s timeout.
  const FIRMWARE_TIMEOUT_MS = 5 * 60 * 1000

  /** Start a channel auto-update; resolves with the initial progress payload. */
  async function startAutoUpdate(
    owner: string,
    debug: 0 | 1,
    opts: CallOptions = {},
  ): Promise<AutoUpdateProgress> {
    return fetchAutoUpdate(origin.value, { owner, debug }, {
      timeoutMs: FIRMWARE_TIMEOUT_MS,
      ...opts,
    })
  }

  /** Poll the in-progress auto-update. */
  async function pollAutoUpdate(opts: CallOptions = {}): Promise<AutoUpdateProgress> {
    return fetchAutoUpdate(origin.value, {}, {
      timeoutMs: FIRMWARE_TIMEOUT_MS,
      ...opts,
    })
  }

  /** Upload a single chunk of a file to the firmware's `/update` uploader. */
  async function uploadChunk(
    args: { offset: number; file: string; size: number; chunk: Uint8Array },
    opts: CallOptions = {},
  ): Promise<{ ok: boolean; text: string }> {
    return postUpdateChunk(origin.value, args, {
      timeoutMs: FIRMWARE_TIMEOUT_MS,
      ...opts,
    })
  }

  return {
    // state
    host,
    status,
    lastError,
    lastUpdated,
    settings,
    polling,
    // getters
    origin,
    lcdWsUrl,
    displayHost,
    // actions
    refresh,
    refreshNow,
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
    commit,
    reboot,
    getMqttCaCert,
    getOcppCaCert,
    verifyLcdPin,
    startAutoUpdate,
    pollAutoUpdate,
    uploadChunk,
  }
})
