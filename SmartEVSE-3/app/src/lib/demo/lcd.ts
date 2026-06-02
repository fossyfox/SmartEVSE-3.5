// Synthesises the SmartEVSE LCD frames for the demo build. The real device
// streams its framebuffer as BMP over `/ws/lcd`; here we draw a believable
// screen to a canvas and encode it as a 24-bit BMP so `useLcd` can render it
// unchanged.
//
// Colour constraint: LcdCard.vue runs the stream through an SVG filter that
// swaps the R and B channels (it undoes a firmware byte-order quirk). Any colour
// with R === B is therefore invariant under that swap, so we paint strictly in
// greyscale + greens (R === B) and the demo looks the same as a real device.
import { lcdInfo } from './device'

const W = 256
const H = 128

let canvas: HTMLCanvasElement | null = null
let ctx: CanvasRenderingContext2D | null = null

// Which info page the buttons have cycled to.
const PAGES = 3
let page = 0

/** Advance to the next LCD page (driven by demo button presses). */
export function cycleLcdPage(): void {
  page = (page + 1) % PAGES
}

function context(): CanvasRenderingContext2D {
  if (!ctx) {
    canvas = document.createElement('canvas')
    canvas.width = W
    canvas.height = H
    ctx = canvas.getContext('2d', { willReadFrequently: true })!
  }
  return ctx
}

function draw(): void {
  const c = context()
  const info = lcdInfo()

  // Background + frame.
  c.fillStyle = 'rgb(8,10,8)'
  c.fillRect(0, 0, W, H)
  c.strokeStyle = 'rgb(48,180,48)'
  c.lineWidth = 2
  c.strokeRect(2, 2, W - 4, H - 4)

  // Header band.
  c.fillStyle = 'rgb(48,180,48)'
  c.fillRect(2, 2, W - 4, 22)
  c.fillStyle = 'rgb(6,8,6)'
  c.font = 'bold 14px monospace'
  c.textBaseline = 'middle'
  c.fillText('SmartEVSE', 10, 14)
  c.textAlign = 'right'
  c.fillText(info.mode, W - 10, 14)
  c.textAlign = 'left'

  c.fillStyle = 'rgb(230,235,230)'

  if (page === 0) {
    // Charging summary.
    c.font = 'bold 30px monospace'
    c.fillStyle = info.charging ? 'rgb(120,235,120)' : 'rgb(150,150,150)'
    c.fillText(`${info.amps.toFixed(1)} A`, 12, 52)
    c.font = '13px monospace'
    c.fillStyle = 'rgb(210,215,210)'
    c.fillText(`${(info.power / 1000).toFixed(2)} kW`, 150, 50)
    c.fillText(`${info.temp}°C`, 150, 70)

    // SoC bar.
    const barX = 12
    const barY = 86
    const barW = W - 24
    const barH = 22
    c.strokeStyle = 'rgb(120,125,120)'
    c.lineWidth = 1
    c.strokeRect(barX, barY, barW, barH)
    const fill = Math.max(0, Math.min(1, info.soc / 100))
    c.fillStyle = 'rgb(60,200,60)'
    c.fillRect(barX + 1, barY + 1, (barW - 2) * fill, barH - 2)
    c.fillStyle = 'rgb(235,240,235)'
    c.font = 'bold 13px monospace'
    c.fillText(`SoC ${info.soc}%`, barX + 6, barY + barH / 2 + 1)

    if (info.charging) {
      // A little marching shimmer at the fill edge so the frame visibly animates.
      const t = (Date.now() / 700) % 1
      const x = barX + 1 + (barW - 2) * fill - 2
      c.fillStyle = `rgba(235,255,235,${0.3 + 0.5 * Math.abs(Math.sin(t * Math.PI))})`
      c.fillRect(Math.max(barX + 1, x), barY + 1, 3, barH - 2)
    }
  } else if (page === 1) {
    // Status page.
    c.font = '15px monospace'
    const lines = [
      `Mode   : ${info.mode}`,
      `State  : ${info.charging ? 'Charging' : 'Idle'}`,
      `Current: ${info.amps.toFixed(1)} A`,
      `Temp   : ${info.temp} C`,
    ]
    lines.forEach((line, i) => c.fillText(line, 14, 44 + i * 20))
  } else {
    // "About the demo" page.
    c.font = '14px monospace'
    c.fillStyle = 'rgb(120,235,120)'
    c.fillText('DEMO DEVICE', 14, 44)
    c.fillStyle = 'rgb(215,220,215)'
    c.font = '12px monospace'
    c.fillText('Simulated SmartEVSE V3', 14, 66)
    c.fillText('PIN to unlock: 1234', 14, 84)
    c.fillText('Buttons cycle these pages', 14, 102)
  }
}

/**
 * Encode RGBA pixels (top-down) as a 24-bit, bottom-up BMP. Pixels are written
 * B,G,R per the BMP spec; LcdCard's filter then leaves our R===B colours intact.
 */
function encodeBmp(rgba: Uint8ClampedArray): ArrayBuffer {
  const rowSize = W * 3
  const padding = (4 - (rowSize % 4)) % 4
  const stride = rowSize + padding
  const pixelBytes = stride * H
  const offset = 54 // 14-byte file header + 40-byte info header
  const buf = new ArrayBuffer(offset + pixelBytes)
  const dv = new DataView(buf)
  const out = new Uint8Array(buf)

  dv.setUint8(0, 0x42)
  dv.setUint8(1, 0x4d) // 'BM'
  dv.setUint32(2, buf.byteLength, true)
  dv.setUint32(10, offset, true)
  dv.setUint32(14, 40, true) // info header size
  dv.setInt32(18, W, true)
  dv.setInt32(22, H, true) // positive height => bottom-up rows
  dv.setUint16(26, 1, true) // planes
  dv.setUint16(28, 24, true) // bits per pixel
  dv.setUint32(34, pixelBytes, true)

  let p = offset
  for (let y = H - 1; y >= 0; y--) {
    let src = y * W * 4
    for (let x = 0; x < W; x++) {
      out[p++] = rgba[src + 2] // B
      out[p++] = rgba[src + 1] // G
      out[p++] = rgba[src] // R
      src += 4
    }
    p += padding
  }
  return buf
}

/** Render the current LCD state as a BMP frame. */
export function renderLcdFrame(): ArrayBuffer {
  draw()
  const c = context()
  const { data } = c.getImageData(0, 0, W, H)
  return encodeBmp(data)
}
