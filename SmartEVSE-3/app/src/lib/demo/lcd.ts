// Synthesises the SmartEVSE LCD frames for the demo build pixel-for-pixel with
// the real device: the firmware's own hires bitmap font (font2.ts, generated
// from src/font2.cpp) on a 128×64 framebuffer, laid out exactly like GLCD()
// (../../../src/glcd.cpp) — 1px rules and 16px text rows. The text per mode/state
// also matches GLCD() — e.g. "READY TO CHARGE", "CHARGING / 10.0A", or the
// Smart/Solar status line that cycles MODE→CHARGING→kW→kWh→A. The device streams
// its framebuffer as BMP over `/ws/lcd`; here we build the same framebuffer and
// encode it as a 24-bit BMP at native 128×64 so `useLcd` renders it unchanged.
//
// Colour/byte order: the firmware writes pixels in RGB order even though BMP is
// BGR; the new UI (LcdCard.vue) undoes that with an R/B-swap filter, so we match
// the firmware and write RGB order here too — then the new UI shows true colours.
// The legacy page renders the BMP raw, so classic.ts injects the same swap there.
import { lcdInfo } from './device'
import { FONT2 } from './font2'

// The device's native LCD resolution. We emit the BMP at exactly this size — no
// scaling — so it's a 1:1 copy of the device framebuffer; the <img> in LcdCard
// upscales it for display (image-rendering: pixelated).
const LCD_W = 128
const LCD_H = 64

// LCD ink, true blue. encodeBmp writes it RGB-order (the firmware quirk) and
// LcdCard's R/B-swap filter restores it — see the file header.
const INK = { r: 22, g: 22, b: 205 }

// Layout taken verbatim from the firmware's GLCD() status screen (glcd.cpp):
// 1px full-width rules where glcd_clrln(1,0x04)/(6,0x10) land, and 16px text at
// 8px "pages" 2 and 4 (the GLCD_print_buf2 row arguments).
const RULE_TOP_Y = 10 // page 1, bit 2
const RULE_BOTTOM_Y = 52 // page 6, bit 4
// Text-row top pixels. Two lines sit on the firmware's pages 2 and 4 (rows 16
// and 32); a lone line is centered between them, so it sits midway in the frame.
const TEXT_Y_1 = 16
const TEXT_Y_2 = 32
const TEXT_Y_SINGLE = (TEXT_Y_1 + TEXT_Y_2) / 2 // 24

// In Smart/Solar the firmware's bottom status line auto-cycles roughly every
// 4 s (GLCD() runs ~1×/s). install.ts pushes a frame every second too, so we
// advance the cycle every 4th frame to match; a button press also nudges it
// forward for instant feedback.
const CYCLE_EVERY_FRAMES = 4
let frameTick = 0
let cycleStep = 0

/** Nudge the Smart/Solar status line forward (driven by demo button presses). */
export function advanceLcdCycle(): void {
  cycleStep++
}

/**
 * The lines the firmware's GLCD() shows for the current state (see
 * ../../../src/glcd.cpp). The demo keeps the real device's two-rule, big-text
 * frame for every mode instead of redrawing the Smart/Solar flow diagram, but
 * the text and values match what the device actually displays.
 */
function screenLines(info: ReturnType<typeof lcdInfo>): string[] {
  switch (info.mode) {
    // AccessStatus OFF, no RFID / delayed start → "ACCESS DENIED".
    case 'OFF':
      return ['ACCESS', 'DENIED']
    // AccessStatus PAUSE → a single "PAUSE" line.
    case 'PAUSE':
      return ['PAUSE']
    // Smart/Solar draw a flow diagram with an auto-cycling status line; show
    // that line's real values: "<MODE> <n>P" → CHARGING → kW → kWh → A.
    case 'SMART':
    case 'SOLAR': {
      if (!info.charging) return ['READY']
      const cycle = [
        `${info.mode} ${info.phases}P`,
        'CHARGING',
        `${(info.power / 1000).toFixed(1)} kW`,
        `${(info.energyWh / 1000).toFixed(2)} kWh`,
        `${info.amps.toFixed(1)} A`,
      ]
      return [cycle[cycleStep % cycle.length]]
    }
    // NORMAL: STATE C shows "CHARGING / <set current>A"; otherwise "READY TO
    // CHARGE". (`amps` is Balanced[0] = settings.charge_current.)
    case 'NORMAL':
    default:
      if (info.charging) return ['CHARGING', `${info.amps.toFixed(1)}A`]
      return ['READY TO', 'CHARGE']
  }
}

/** Light one ink pixel in the RGBA framebuffer (bounds-checked). */
function setPixel(d: Uint8ClampedArray, x: number, y: number): void {
  if (x < 0 || x >= LCD_W || y < 0 || y >= LCD_H) return
  const i = (y * LCD_W + x) * 4
  d[i] = INK.r
  d[i + 1] = INK.g
  d[i + 2] = INK.b
}

/**
 * Blit one font2 string into the framebuffer, horizontally centered with its top
 * at pixel row `yTop` — a faithful port of the firmware's GLCD_print_buf2 /
 * GLCD_write_buf2. Each glyph is `width` columns of two stacked bytes (top then
 * bottom page), bit n being the pixel n rows down, followed by a 2px gap.
 * Centering uses `64 - text_length2/2` with the device's integer truncation.
 */
function drawLine(d: Uint8ClampedArray, str: string, yTop: number): void {
  let total = 0
  for (let i = 0; i < str.length; i++) total += (FONT2[str.charCodeAt(i)]?.[0] ?? 0) + 2
  let x = 64 - ((total - 2) >> 1)
  for (let i = 0; i < str.length; i++) {
    const glyph = FONT2[str.charCodeAt(i)]
    if (!glyph) {
      x += 2
      continue
    }
    const width = glyph[0]
    for (let col = 0; col < width; col++) {
      const top = glyph[1 + col * 2]
      const bottom = glyph[2 + col * 2]
      for (let bit = 0; bit < 8; bit++) {
        if (top & (1 << bit)) setPixel(d, x + col, yTop + bit)
        if (bottom & (1 << bit)) setPixel(d, x + col, yTop + 8 + bit)
      }
    }
    x += width + 2
  }
}

/** Compose the current status screen into a fresh 128×64 RGBA framebuffer. */
function drawScreen(): Uint8ClampedArray {
  const d = new Uint8ClampedArray(LCD_W * LCD_H * 4)
  d.fill(255) // white field, fully opaque

  for (let x = 0; x < LCD_W; x++) {
    setPixel(d, x, RULE_TOP_Y)
    setPixel(d, x, RULE_BOTTOM_Y)
  }

  // Two lines fill the firmware's text rows; a single line is centered between
  // them so short screens (PAUSE, Smart/Solar status) sit mid-frame.
  const lines = screenLines(lcdInfo())
  if (lines.length > 1) {
    drawLine(d, lines[0], TEXT_Y_1)
    drawLine(d, lines[1], TEXT_Y_2)
  } else {
    drawLine(d, lines[0], TEXT_Y_SINGLE)
  }

  return d
}

/**
 * Encode top-down RGBA pixels as a 24-bit, bottom-up BMP, writing each pixel in
 * R,G,B order (the firmware's quirk — see the file header). On the new UI the
 * R/B-swap filter then yields the exact canvas colours.
 */
function encodeBmp(rgba: Uint8ClampedArray, w: number, h: number): ArrayBuffer {
  const rowSize = w * 3
  const padding = (4 - (rowSize % 4)) % 4
  const stride = rowSize + padding
  const offset = 54
  const buf = new ArrayBuffer(offset + stride * h)
  const dv = new DataView(buf)
  const o = new Uint8Array(buf)

  dv.setUint8(0, 0x42)
  dv.setUint8(1, 0x4d) // 'BM'
  dv.setUint32(2, buf.byteLength, true)
  dv.setUint32(10, offset, true)
  dv.setUint32(14, 40, true)
  dv.setInt32(18, w, true)
  dv.setInt32(22, h, true) // positive => bottom-up
  dv.setUint16(26, 1, true)
  dv.setUint16(28, 24, true)
  dv.setUint32(34, stride * h, true)

  let p = offset
  for (let y = h - 1; y >= 0; y--) {
    let src = y * w * 4
    for (let x = 0; x < w; x++) {
      o[p++] = rgba[src] // R
      o[p++] = rgba[src + 1] // G
      o[p++] = rgba[src + 2] // B
      src += 4
    }
    p += padding
  }
  return buf
}

/** Render the current LCD state as a native-resolution 128×64 BMP frame. */
export function renderLcdFrame(): ArrayBuffer {
  frameTick++
  if (frameTick % CYCLE_EVERY_FRAMES === 0) cycleStep++
  return encodeBmp(drawScreen(), LCD_W, LCD_H)
}
