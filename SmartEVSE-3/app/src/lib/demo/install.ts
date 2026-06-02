// Demo mode wiring. Replaces `window.fetch`, `window.XMLHttpRequest` and
// `window.WebSocket` with interceptors backed by the in-browser mock device, so
// the public demo runs as a fully static site with no SmartEVSE and no backend.
//
// `fetch` covers the new Vue UI; `XMLHttpRequest` covers the legacy jQuery UI
// ($.ajax/$.post/$.get); `WebSocket` covers the LCD stream for both. Loaded only
// in the `--mode demo` build (see main.ts) and the injected classic-page bundle
// (see classic.ts).
import { handleDeviceRequest, isDevicePath } from './handler'
import { advanceLcdCycle, renderLcdFrame } from './lcd'

function installFetch(): void {
  const original = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const raw = input instanceof Request ? input.url : String(input)
    let url: URL
    try {
      url = new URL(raw, location.origin)
    } catch {
      return original(input, init)
    }
    if (url.origin !== location.origin || !isDevicePath(url.pathname)) {
      return original(input, init)
    }

    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    const body = typeof init?.body === 'string' ? init.body : ''
    const res = handleDeviceRequest(method, url.pathname, url.searchParams, body)
    if (!res) return original(input, init)
    return new Response(res.body, { status: res.status, headers: { 'Content-Type': res.contentType } })
  }
}

// Drop-in XMLHttpRequest that answers device endpoints from the mock and proxies
// everything else to a real XHR (e.g. jQuery Mobile's ajax page navigation).
function installXhr(): void {
  const Native = window.XMLHttpRequest

  class DemoXhr {
    static readonly UNSENT = 0
    static readonly OPENED = 1
    static readonly HEADERS_RECEIVED = 2
    static readonly LOADING = 3
    static readonly DONE = 4

    readyState = 0
    status = 0
    statusText = ''
    responseText = ''
    response: unknown = ''
    responseURL = ''
    responseType: XMLHttpRequestResponseType = ''
    timeout = 0
    withCredentials = false
    onreadystatechange: ((ev: Event) => void) | null = null
    onload: ((ev: Event) => void) | null = null
    onerror: ((ev: Event) => void) | null = null
    onloadend: ((ev: Event) => void) | null = null
    onloadstart: ((ev: Event) => void) | null = null
    onprogress: ((ev: Event) => void) | null = null
    onabort: ((ev: Event) => void) | null = null
    ontimeout: ((ev: Event) => void) | null = null

    private method = 'GET'
    private url = ''
    private device = false
    private real: XMLHttpRequest | null = null
    private respHeaders: Record<string, string> = {}
    private listeners: Record<string, ((ev: Event) => void)[]> = {}

    open(method: string, url: string, async = true, user?: string | null, password?: string | null): void {
      this.method = method.toUpperCase()
      this.url = String(url)
      let parsed: URL | null = null
      try {
        parsed = new URL(this.url, location.origin)
      } catch {
        parsed = null
      }
      this.device = !!parsed && parsed.origin === location.origin && isDevicePath(parsed.pathname)
      if (!this.device) {
        const real = new Native()
        this.real = real
        real.open(method, url, async, user, password)
        this.bindReal(real)
      }
      this.readyState = 1
    }

    setRequestHeader(name: string, value: string): void {
      this.real?.setRequestHeader(name, value)
    }

    send(body?: Document | XMLHttpRequestBodyInit | null): void {
      if (!this.device) {
        this.real?.send(body as XMLHttpRequestBodyInit | null)
        return
      }
      const u = new URL(this.url, location.origin)
      const res = handleDeviceRequest(
        this.method,
        u.pathname,
        u.searchParams,
        typeof body === 'string' ? body : '',
      )
      // Answer asynchronously so callers can attach handlers after send().
      setTimeout(() => {
        this.status = res ? res.status : 404
        this.statusText = res ? 'OK' : 'Not Found'
        this.responseText = res ? res.body : ''
        this.response = this.responseText
        this.responseURL = this.url
        this.respHeaders = res ? { 'content-type': res.contentType } : {}
        this.readyState = 4
        this.fire('readystatechange')
        this.fire('load')
        this.fire('loadend')
      }, 10)
    }

    abort(): void {
      this.real?.abort()
    }

    getResponseHeader(name: string): string | null {
      if (this.real) return this.real.getResponseHeader(name)
      return this.respHeaders[name.toLowerCase()] ?? null
    }

    getAllResponseHeaders(): string {
      if (this.real) return this.real.getAllResponseHeaders()
      return Object.entries(this.respHeaders)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\r\n')
        .concat('\r\n')
    }

    addEventListener(type: string, cb: (ev: Event) => void): void {
      ;(this.listeners[type] ||= []).push(cb)
      this.real?.addEventListener(type, cb)
    }

    removeEventListener(type: string, cb: (ev: Event) => void): void {
      this.listeners[type] = (this.listeners[type] ?? []).filter((fn) => fn !== cb)
      this.real?.removeEventListener(type, cb)
    }

    private fire(type: string): void {
      const ev = new Event(type)
      const handler = (this as unknown as Record<string, ((ev: Event) => void) | null>)[`on${type}`]
      handler?.call(this, ev)
      ;(this.listeners[type] ?? []).forEach((cb) => cb.call(this, ev))
    }

    // Mirror a proxied real XHR's state onto this wrapper as events fire.
    private bindReal(real: XMLHttpRequest): void {
      real.onreadystatechange = () => {
        this.readyState = real.readyState
        this.status = real.status
        this.statusText = real.statusText
        try {
          this.responseText = real.responseType === '' || real.responseType === 'text' ? real.responseText : ''
        } catch {
          /* responseText throws for some responseTypes */
        }
        this.response = real.response
        this.fire('readystatechange')
      }
      real.onload = () => this.fire('load')
      real.onerror = () => this.fire('error')
      real.onloadend = () => this.fire('loadend')
    }
  }

  window.XMLHttpRequest = DemoXhr as unknown as typeof XMLHttpRequest
}

// Minimal WebSocket stand-in for `/ws/lcd`: streams generated BMP frames and
// reacts to button presses. Anything else falls back to the real WebSocket.
function installWebSocket(): void {
  const Native = window.WebSocket

  class DemoLcdSocket {
    static readonly CONNECTING = 0
    static readonly OPEN = 1
    static readonly CLOSING = 2
    static readonly CLOSED = 3
    readonly CONNECTING = 0
    readonly OPEN = 1
    readonly CLOSING = 2
    readonly CLOSED = 3

    url: string
    binaryType: BinaryType = 'blob'
    readyState = 0
    onopen: ((ev: Event) => void) | null = null
    onmessage: ((ev: MessageEvent) => void) | null = null
    onerror: ((ev: Event) => void) | null = null
    onclose: ((ev: CloseEvent) => void) | null = null

    private timer: ReturnType<typeof setInterval> | null = null

    constructor(url: string | URL) {
      this.url = String(url)
      setTimeout(() => this.open(), 80)
    }

    private open(): void {
      if (this.readyState !== this.CONNECTING) return
      this.readyState = this.OPEN
      this.onopen?.(new Event('open'))
      this.push()
      this.timer = setInterval(() => this.push(), 1000)
    }

    private push(): void {
      if (this.readyState !== this.OPEN) return
      this.onmessage?.(new MessageEvent('message', { data: renderLcdFrame() }))
    }

    send(data: string): void {
      try {
        const msg = JSON.parse(data) as { button?: string; state?: number }
        if (msg.state === 0 && (msg.button === 'left' || msg.button === 'right')) {
          advanceLcdCycle()
          this.push()
        }
      } catch {
        /* ignore non-JSON */
      }
    }

    close(code = 1000): void {
      if (this.timer) clearInterval(this.timer)
      this.timer = null
      this.readyState = this.CLOSED
      this.onclose?.(new CloseEvent('close', { code }))
    }

    addEventListener(): void {}
    removeEventListener(): void {}
  }

  window.WebSocket = new Proxy(Native, {
    construct(target, args: [string | URL, (string | string[])?]) {
      const url = String(args[0] ?? '')
      if (url.includes('/ws/lcd')) return new DemoLcdSocket(args[0]) as unknown as WebSocket
      return Reflect.construct(target, args)
    },
  })
}

/** Install the demo interceptors once, before the app starts polling. */
export function installDemo(): void {
  const flag = '__smartevseDemoInstalled'
  const w = window as unknown as Record<string, boolean>
  if (w[flag]) return // guard against double-install (e.g. jQuery Mobile re-runs)
  w[flag] = true
  installFetch()
  installXhr()
  installWebSocket()
}
