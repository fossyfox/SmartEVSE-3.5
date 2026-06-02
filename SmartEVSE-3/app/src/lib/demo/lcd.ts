// Synthesises the SmartEVSE LCD frames for the demo build, mimicking the real
// device screen: blue blocky text on a white field between two horizontal rules.
// The text shown for each mode/state matches the firmware's GLCD() status screen
// (../../../src/glcd.cpp) — e.g. "READY TO CHARGE", "CHARGING / 10.0A", or the
// Smart/Solar status line that cycles MODE→CHARGING→kW→kWh→A. The device streams
// its framebuffer as BMP over `/ws/lcd`; here we draw the screen to a canvas and
// encode it as a 24-bit BMP so `useLcd` renders it unchanged.
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
  frameTick++
  if (frameTick % CYCLE_EVERY_FRAMES === 0) cycleStep++
  drawScreen()
  const { hi } = contexts()
  hi.imageSmoothingEnabled = false
  hi.clearRect(0, 0, OUT_W, OUT_H)
  hi.drawImage(lcd!, 0, 0, LCD_W, LCD_H, 0, 0, OUT_W, OUT_H)
  return encodeBmp(hi.getImageData(0, 0, OUT_W, OUT_H).data, OUT_W, OUT_H)
}
