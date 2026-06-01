import { fileURLToPath, URL } from 'node:url'
import { Agent } from 'node:http'

import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  // VITE_DEVICE_HOST proxies the SmartEVSE HTTP + WS endpoints to real hardware,
  // dodging browser CORS. Keep the in-app host field empty so requests forward.
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
    '/autoupdate',
    '/mqtt_ca_cert',
    '/ocpp_ca_cert',
    '/lcd-verify-password',
  ]

  // Without this, the proxy opens a fresh TCP socket per request. A same-origin
  // browser reuses one keep-alive socket, but the proxy doesn't by default, so a
  // chunked firmware upload (~750 sequential POSTs to /update) piles up sockets in
  // TIME_WAIT on the device's tiny lwIP pool until it stops accepting connections
  // and the upload hangs halfway. Reuse a small, bounded keep-alive pool instead.
  const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 4 })

  const proxy = httpTarget
    ? {
        ...Object.fromEntries(
          httpPaths.map((path) => [
            path,
            { target: httpTarget, changeOrigin: true, agent: keepAliveAgent },
          ]),
        ),
        '/ws': {
          target: httpTarget.replace(/^http/, 'ws'),
          ws: true,
          changeOrigin: true,
        },
      }
    : undefined

  return {
    // Relative base so the built bundle works served from any path on the device.
    base: './',
    // `--mode singlefile` inlines JS + CSS into one index.html that the firmware
    // packs and serves at /app.html; default build keeps hashed assets for caching.
    plugins: [
      vue(),
      tailwindcss(),
      ...(mode === 'singlefile' ? [viteSingleFile()] : []),
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
