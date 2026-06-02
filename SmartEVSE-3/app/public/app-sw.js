// Service worker for the SmartEVSE PWA.
//
// Purpose: let the UI be installed to the home screen / launched standalone, and
// still open when the device is briefly unreachable. The device is the only data
// source, so this caches the *static shell* (the HTML/JS/CSS/icon) — not device
// data. Live endpoints (/settings, /ws, …) always go straight to the network.
//
// Everything here uses request-keyed runtime caching, no hardcoded paths, so the
// same worker is correct wherever the bundle is mounted (/ in dev, /app.html on
// the device). The shell is cached on first successful online load; there is
// nothing to precache.

const CACHE = 'smartevse-shell-v1'

// Device API + WebSocket paths — must never be served from cache. Mirrors the
// proxied paths in vite.config.ts.
const LIVE = /^\/(settings|reboot|update|autoupdate|ws|mqtt_ca_cert|ocpp_ca_cert|lcd-verify-password)(\/|$)/

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Only our own static shell is cacheable. Skip non-GET, cross-origin requests
  // (e.g. a device addressed by IP) and live device endpoints — let the browser
  // handle those normally so data is always fresh.
  if (req.method !== 'GET' || url.origin !== self.location.origin || LIVE.test(url.pathname)) return

  // Network-first: always prefer fresh bytes from the device; fall back to the
  // last cached copy so the installed app still opens when it's unreachable.
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((cache) => cache.put(req, copy))
        }
        return res
      })
      .catch(() => caches.match(req)),
  )
})
