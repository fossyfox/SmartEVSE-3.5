// Builds the demo copies of the legacy jQuery UI. For each classic page in
// ../data it injects the compiled mock (classic-mock.js, built by
// vite.classic.config.ts) at the top of <head> — so the mock device is patched
// in before any page script runs — and rewrites internal links for the static
// Vercel layout. Output goes next to the Vue app in dist/.
//
// Page layout on the deploy:
//   /            -> Vue app   (dist/index.html)
//   /app.html    -> Vue app   (vercel.json rewrite)
//   /classic.html-> legacy home (this script, from data/index.html)
//   /capacity.html, /interval.html, /update2.html -> legacy sub-pages
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const appDir = resolve(here, '..')
const dataDir = resolve(appDir, '..', 'data')
const distDir = resolve(appDir, 'dist')

// The legacy home (index.html) is served at /classic.html so it doesn't collide
// with the Vue app's index.html; sub-pages keep their names.
const PAGES = [
  { src: 'index.html', out: 'classic.html' },
  { src: 'capacity.html', out: 'capacity.html' },
  { src: 'interval.html', out: 'interval.html' },
  { src: 'update2.html', out: 'update2.html' },
]

const SCRIPT_TAG = '<script src="/classic-mock.js"></script>'

if (!existsSync(resolve(distDir, 'classic-mock.js'))) {
  console.error('[inject-classic] dist/classic-mock.js missing — run the classic vite build first.')
  process.exit(1)
}
mkdirSync(distDir, { recursive: true })

let wrote = 0
for (const { src, out } of PAGES) {
  const srcPath = resolve(dataDir, src)
  if (!existsSync(srcPath)) {
    console.warn(`[inject-classic] skip missing ${src}`)
    continue
  }
  let html = readFileSync(srcPath, 'utf8')

  // Patch the mock in before anything else loads.
  if (/<head[^>]*>/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n  ${SCRIPT_TAG}`)
  } else {
    html = `${SCRIPT_TAG}\n${html}`
  }

  // The classic "home" link is index.html on the device; here that's classic.html.
  html = html.replace(/href="\/?index\.html"/gi, 'href="/classic.html"')

  writeFileSync(resolve(distDir, out), html)
  console.log(`[inject-classic] wrote dist/${out}`)
  wrote++
}

console.log(`[inject-classic] done (${wrote} page${wrote === 1 ? '' : 's'}).`)
