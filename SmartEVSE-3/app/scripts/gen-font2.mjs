// Generate src/lib/demo/font2.ts from the firmware's hires font (src/font2.cpp).
// The demo LCD renderer (src/lib/demo/lcd.ts) draws with this exact bitmap so
// the synthesised frames match the real device pixel-for-pixel. Re-run after the
// firmware font changes:  node scripts/gen-font2.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(here, '../../src/font2.cpp') // firmware font
const OUT = resolve(here, '../src/lib/demo/font2.ts')

const lines = readFileSync(SRC, 'utf8').split('\n')

// The non-FULL_CHARSET table is font2[0x7F] = entries 0x00..0x7E, i.e. every
// `{…},` row from the table opening up to the `#ifdef GLCD_FULL_CHARSET` marker.
const start = lines.findIndex((l) => l.includes('const unsigned char font2'))
const full = lines.findIndex((l, i) => i > start && l.includes('GLCD_FULL_CHARSET'))
if (start < 0 || full < 0) throw new Error('could not locate font2 table bounds in ' + SRC)

const glyphs = {}
let code = 0
for (let i = start + 1; i < full; i++) {
  const m = lines[i].match(/^\s*\{(.*)\}\s*,/)
  if (!m) continue
  const bytes = (m[1].match(/0x[0-9A-Fa-f]+/g) ?? []).map((h) => parseInt(h, 16))
  if (bytes.length === 0) continue
  // bytes[0] is the glyph width; 0 = empty/non-printable control char → skip.
  if (bytes[0] > 0) glyphs[code] = bytes
  code++
}

const codes = Object.keys(glyphs)
  .map(Number)
  .sort((a, b) => a - b)
const entries = codes
  .map((c) => {
    const label = c === 0x20 ? 'space' : String.fromCharCode(c)
    return `  ${c}: [${glyphs[c].join(', ')}], // 0x${c.toString(16).toUpperCase()} ${label}`
  })
  .join('\n')

const out = `// AUTO-GENERATED from firmware src/font2.cpp (GLCD_HIRES_FONT) — do not edit by
// hand; re-run scripts/gen-font2.mjs if the firmware font changes. The SmartEVSE
// LCD draws this 16px-tall hires font; the demo renders it pixel-for-pixel.
//
// Per glyph: [width, col0_top, col0_bot, col1_top, col1_bot, …]. Each column is
// two bytes — the top 8px page then the bottom 8px page — and bit n of a byte is
// pixel row n within that page (LSB = top), matching the device framebuffer.
export const FONT2: Record<number, readonly number[]> = {
${entries}
}
`

writeFileSync(OUT, out)
console.log(`gen-font2: wrote ${codes.length} glyphs (0x${codes[0].toString(16)}–0x${codes[codes.length - 1].toString(16)}) to ${OUT}`)
