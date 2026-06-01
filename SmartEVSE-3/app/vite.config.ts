import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // When VITE_DEVICE_HOST is set, the dev server proxies the SmartEVSE HTTP +
  // WebSocket endpoints to a real device. This lets you develop against
  // hardware without running into browser CORS restrictions: keep the in-app
  // host field empty and all `/settings`, `/reboot`, … requests are forwarded.
  const rawHost = env.VITE_DEVICE_HOST?.trim() ?? ''
  const httpTarget = rawHost
    ? rawHost.startsWith('http')
      ? rawHost
      : `http://${rawHost}`
    : ''

  const httpPaths = [
    '/settings',
    '/reboot',
    '/update',
    '/mqtt_ca_cert',
    '/ocpp_ca_cert',
    '/lcd-verify-password',
  ]

  const proxy = httpTarget
    ? {
        ...Object.fromEntries(
          httpPaths.map((path) => [path, { target: httpTarget, changeOrigin: true }]),
        ),
        '/ws': {
          target: httpTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      }
    : undefined

  return {
    // Relative base so the built bundle works when served from the device root.
    base: './',
    // With VITE_SINGLE_FILE (set by `npm run build:singlefile`), viteSingleFile
    // inlines the JS + CSS into a single self-contained index.html. Combined
    // with `base: './'` the result works under any mount path on the external
    // static host (or served off the device). The default build keeps separate
    // hashed asset files for chunk-level caching.
    plugins: [
      vue(),
      tailwindcss(),
      ...(env.VITE_SINGLE_FILE ? [viteSingleFile()] : []),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: true,
      proxy,
    },
  }
})
