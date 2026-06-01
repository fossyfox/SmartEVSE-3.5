/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Device host used by the Vite dev proxy (e.g. `192.168.1.50` or `smartevse.local`). */
  readonly VITE_DEVICE_HOST?: string
  /** Default host pre-filled in the UI connection field. */
  readonly VITE_DEFAULT_HOST?: string
  /** Polling interval in milliseconds (default 5000). */
  readonly VITE_POLL_INTERVAL?: string
  /** When `'true'`, route all requests same-origin via the bundled proxy and
   *  pass the chosen device in the `X-Device-Host` header (no browser CORS). */
  readonly VITE_PROXY_MODE?: string
  /** Origin of the bundled proxy when not same-origin (usually left empty). */
  readonly VITE_PROXY_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
