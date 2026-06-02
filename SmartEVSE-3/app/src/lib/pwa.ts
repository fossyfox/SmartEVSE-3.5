// Progressive Web App registration.
//
// Registers the service worker (app-sw.js, served from the same origin) so the
// UI can be installed to the home screen and launched standalone, and still
// opens when the device is briefly unreachable.
//
// `navigator.serviceWorker` only exists in a secure context (HTTPS or
// localhost). When the device serves the app over plain HTTP this is a no-op and
// the app runs exactly as before — on iOS it can still be added to the home
// screen as a standalone app via the manifest + apple-touch meta tags, and a
// full install works in dev (localhost) or when the device is fronted by HTTPS.
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return

  // Resolve relative to the current document so it works wherever the bundle is
  // mounted (/ in dev, /app.html on the device); scope defaults to the worker's
  // directory (the origin root).
  const url = new URL('app-sw.js', document.baseURI).href

  window.addEventListener('load', () => {
    // Best-effort: the app is fully functional without the worker.
    navigator.serviceWorker.register(url).catch(() => {})
  })
}
