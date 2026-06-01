import { onScopeDispose, ref, watch, type Ref } from 'vue'

type LcdState = 'info' | 'warning' | 'error'

const MAX_ATTEMPTS = 3
const RETRY_DELAY_MS = 2000
const CONNECT_TIMEOUT_MS = 8000
const MIN_PRESS_MS = 300
const PAUSED_KEY = 'smartevse.lcdPaused'

/**
 * Manages the SmartEVSE LCD WebSocket: streams BMP frames, sends button
 * presses, and handles reconnection. Mirrors the behaviour of the original
 * inline `/ws/lcd` client in a composable.
 *
 * `wsUrl` is the fully-resolved `ws(s)://…/ws/lcd` endpoint (built by the store
 * so all proxy/host logic lives in one place). Changing it — e.g. selecting a
 * different device — restarts the connection.
 */
export function useLcd(wsUrl: Ref<string>) {
  const frameUrl = ref<string | null>(null)
  // Persisted across reloads in localStorage (like the store's host) so a user
  // who paused the LCD stays paused next visit.
  const paused = ref(localStorage.getItem(PAUSED_KEY) === '1')
  const statusText = ref(paused.value ? 'Paused' : 'Starting…')
  const statusState = ref<LcdState>('info')
  const connected = ref(false)

  let socket: WebSocket | null = null
  let activeBlobUrl: string | null = null
  let attempts = 0
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let connectTimer: ReturnType<typeof setTimeout> | null = null
  const pressTimes = new Map<string, number>()

  function setStatus(text: string, state: LcdState = 'info') {
    statusText.value = text
    statusState.value = state
  }

  function clearTimers() {
    if (reconnectTimer) clearTimeout(reconnectTimer)
    if (connectTimer) clearTimeout(connectTimer)
    reconnectTimer = connectTimer = null
  }

  function scheduleReconnect() {
    if (stopped || reconnectTimer) return
    setStatus(`Reconnecting… (attempt ${attempts + 1}/${MAX_ATTEMPTS})`, 'warning')
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, RETRY_DELAY_MS)
  }

  function connect() {
    if (paused.value) return
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return
    }
    if (attempts >= MAX_ATTEMPTS) {
      stopped = true
      setStatus(`LCD unavailable after ${MAX_ATTEMPTS} attempts.`, 'error')
      return
    }
    setStatus('Connecting to LCD…', 'info')

    let s: WebSocket
    try {
      s = new WebSocket(wsUrl.value)
    } catch (err) {
      attempts += 1
      setStatus(`LCD error: ${(err as Error).message}`, 'error')
      scheduleReconnect()
      return
    }
    socket = s
    s.binaryType = 'arraybuffer'

    connectTimer = setTimeout(() => {
      if (s.readyState === WebSocket.CONNECTING) s.close()
    }, CONNECT_TIMEOUT_MS)

    s.onopen = () => {
      if (connectTimer) clearTimeout(connectTimer)
      attempts = 0
      stopped = false
      connected.value = true
      setStatus('Connected', 'info')
    }

    s.onmessage = (event) => {
      if (!(event.data instanceof ArrayBuffer)) return
      const url = URL.createObjectURL(new Blob([event.data], { type: 'image/bmp' }))
      if (activeBlobUrl) URL.revokeObjectURL(activeBlobUrl)
      activeBlobUrl = url
      frameUrl.value = url
    }

    s.onerror = () => {
      if (s.readyState !== WebSocket.CLOSED) s.close()
    }

    s.onclose = (event) => {
      if (connectTimer) clearTimeout(connectTimer)
      connected.value = false
      if (socket === s) socket = null
      if (event.code === 1000) return
      attempts += 1
      if (attempts >= MAX_ATTEMPTS) {
        stopped = true
        setStatus(`LCD unavailable after ${MAX_ATTEMPTS} attempts.`, 'error')
        return
      }
      scheduleReconnect()
    }
  }

  function restart() {
    if (paused.value) return
    attempts = 0
    stopped = false
    clearTimers()
    connect()
  }

  // Pause stops streaming and tears down the socket so the device isn't pushing
  // frames we ignore; the last frame stays on screen behind the paused overlay.
  // Resume reconnects from scratch.
  function pause() {
    if (paused.value) return
    paused.value = true
    clearTimers()
    socket?.close(1000)
    socket = null
    connected.value = false
    setStatus('Paused', 'info')
  }

  function resume() {
    if (!paused.value) return
    paused.value = false
    restart()
  }

  function togglePause() {
    if (paused.value) resume()
    else pause()
  }

  watch(paused, (value) => {
    if (value) localStorage.setItem(PAUSED_KEY, '1')
    else localStorage.removeItem(PAUSED_KEY)
  })

  function disconnect() {
    clearTimers()
    stopped = true
    socket?.close(1000)
    socket = null
    if (activeBlobUrl) {
      URL.revokeObjectURL(activeBlobUrl)
      activeBlobUrl = null
    }
    connected.value = false
  }

  function send(button: string, state: 0 | 1) {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      restart()
      return
    }
    socket.send(JSON.stringify({ button, state }))
  }

  function pressButton(button: string) {
    pressTimes.set(button, Date.now())
    send(button, 1)
  }

  function releaseButton(button: string) {
    const elapsed = Date.now() - (pressTimes.get(button) ?? 0)
    const fire = () => {
      send(button, 0)
      pressTimes.delete(button)
    }
    if (elapsed < MIN_PRESS_MS) setTimeout(fire, MIN_PRESS_MS - elapsed)
    else fire()
  }

  // Connect on mount and reconnect on visibility / network changes, and when
  // the device (and thus the URL) changes. `immediate` kicks off the initial
  // connection — without it the socket would never open and the LCD would hang
  // on its starting message.
  const onVisible = () => {
    if (document.visibilityState === 'visible' && stopped) restart()
  }
  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('online', restart)
  const stopWatch = watch(wsUrl, () => restart(), { immediate: true })

  onScopeDispose(() => {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', restart)
    stopWatch()
    disconnect()
  })

  return {
    frameUrl,
    statusText,
    statusState,
    connected,
    paused,
    connect,
    restart,
    disconnect,
    pause,
    resume,
    togglePause,
    pressButton,
    releaseButton,
  }
}
