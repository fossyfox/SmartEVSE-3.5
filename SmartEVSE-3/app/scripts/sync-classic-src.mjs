// Refreshes the vendored copies of the legacy jQuery UI used by the demo build.
// The Vercel build's root directory is app/, so it can't read ../data; these
// copies live inside the app instead. Run `npm run sync:classic` whenever the
// device's legacy UI changes. (This reads ../data, so it only works in a full
// checkout — not on Vercel, which is exactly why the copies are committed.)
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const dataDir = resolve(appDir, '..', 'data')

const PAGES = ['index.html', 'capacity.html', 'interval.html', 'update2.html']
const ASSETS = ['styling.css', 'SmartEVSE.webp']

if (!existsSync(dataDir)) {
  console.error(`[sync:classic] ${dataDir} not found — run from a full checkout.`)
  process.exit(1)
}
mkdirSync(resolve(appDir, 'classic-src'), { recursive: true })

for (const f of PAGES) {
  copyFileSync(resolve(dataDir, f), resolve(appDir, 'classic-src', f))
  console.log(`[sync:classic] classic-src/${f}`)
}
for (const f of ASSETS) {
  copyFileSync(resolve(dataDir, f), resolve(appDir, 'public', f))
  console.log(`[sync:classic] public/${f}`)
}
console.log('[sync:classic] done.')
