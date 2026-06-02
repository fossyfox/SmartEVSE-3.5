// Synthesises the SmartEVSE LCD frames for the demo build, mimicking the real
// device screen: blue blocky text on a white field between two horizontal rules
// (e.g. "READY TO CHARGE"). The device streams its framebuffer as BMP over
// `/ws/lcd`; here we draw the screen to a canvas and encode it as a 24-bit BMP so
// `useLcd` renders it unchanged.
//
// Colour/byte order: the firmware writes pixels in RGB order even though BMP is
// BGR; the new UI (LcdCard.vue) undoes that with an R/B-swap filter, so we match
// the firmware and write RGB order here too — then the new UI shows true colours.
// The legacy page renders the BMP raw, so classic.ts injects the same swap there.
import { lcdInfo } from './device'

// Native-ish low resolution, then nearest-neighbour upscaled 2x so the text has
// the chunky pixelated look of the real LCD regardless of how a page scales it.
const LCD_W = 128
const LCD_H = 64
const SCALE = 2
const OUT_W = LCD_W * SCALE
const OUT_H = LCD_H * SCALE

const BLUE = 'rgb(22,22,205)'
const WHITE = 'rgb(255,255,255)'
const FONT = 'Arial, Helvetica, sans-serif'

let lcd: HTMLCanvasElement | null = null
let lcdCtx: CanvasRenderingContext2D | null = null
let out: HTMLCanvasElement | null = null
let outCtx: CanvasRenderingContext2D | null = null

// Which screen the buttons have cycled to.
const PAGES = 2
let page = 0

/** Advance to the next LCD screen (driven by demo button presses). */
export function cycleLcdPage(): void {
  page = (page + 1) % PAGES
}

function contexts(): { lo: CanvasRenderingContext2D; hi: CanvasRenderingContext2D } {
  if (!lcdCtx || !outCtx) {
    lcd = document.createElement('canvas')
    lcd.width = LCD_W
    lcd.height = LCD_H
    lcdCtx = lcd.getContext('2d')!
    out = document.createElement('canvas')
    out.width = OUT_W
    out.height = OUT_H
    outCtx = out.getContext('2d', { willReadFrequently: true })!
  }
  return { lo: lcdCtx, hi: outCtx }
}

/** Largest bold pixel size at which every line fits within maxW. */
function fitFont(c: CanvasRenderingContext2D, lines: string[], maxW: number, maxPx: number): number {
  for (let px = maxPx; px > 6; px--) {
    c.font = `bold ${px}px ${FONT}`
    if (lines.every((l) => c.measureText(l).width <= maxW)) return px
  }
  return 6
}

/** The text shown on the current screen, by simulated device state. */
function screenLines(info: ReturnType<typeof lcdInfo>): string[] {
  if (page === 1) {
    return [`${(info.power / 1000).toFixed(1)} kW`, `${info.soc}% SOC`]
  }
  if (info.charging) return ['CHARGING', `${Math.round(info.amps)} A`]
  if (info.mode === 'OFF') return ['OFF']
  if (info.mode === 'PAUSE') return ['PAUSED']
  return ['READY TO', 'CHARGE']
}

function drawScreen(): void {
  const { lo: c } = contexts()
  c.fillStyle = WHITE
  c.fillRect(0, 0, LCD_W, LCD_H)

  // Two horizontal rules — the signature SmartEVSE status-screen frame.
  c.fillStyle = BLUE
  c.fillRect(7, 12, LCD_W - 14, 2)
  c.fillRect(7, LCD_H - 14, LCD_W - 14, 2)

  const lines = screenLines(lcdInfo())
  c.fillStyle = BLUE
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  const cx = LCD_W / 2
  const maxW = LCD_W - 16

  if (lines.length === 1) {
    c.font = `bold ${fitFont(c, lines, maxW, 26)}px ${FONT}`
    c.fillText(lines[0], cx, LCD_H / 2 + 1)
  } else {
    const px = fitFont(c, lines, maxW, 20)
    c.font = `bold ${px}px ${FONT}`
    const gap = px + 3
    const top = LCD_H / 2 - gap / 2 + 1
    c.fillText(lines[0], cx, top)
    c.fillText(lines[1], cx, top + gap)
  }
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

/** Render the current LCD state as a BMP frame. */
export function renderLcdFrame(): ArrayBuffer {
  drawScreen()
  const { hi } = contexts()
  hi.imageSmoothingEnabled = false
  hi.clearRect(0, 0, OUT_W, OUT_H)
  hi.drawImage(lcd!, 0, 0, LCD_W, LCD_H, 0, 0, OUT_W, OUT_H)
  return encodeBmp(hi.getImageData(0, 0, OUT_W, OUT_H).data, OUT_W, OUT_H)
}
