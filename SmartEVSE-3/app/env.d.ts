/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Device host used by the Vite dev proxy (e.g. `192.168.1.50` or `smartevse.local`). */
  readonly VITE_DEVICE_HOST?: string
  /** Polling interval in milliseconds (default 5000). */
  readonly VITE_POLL_INTERVAL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, unknown>, Record<string, unknown>, unknown>
  export default component
}
