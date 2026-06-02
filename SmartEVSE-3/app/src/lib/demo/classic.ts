// Entry point bundled (as an IIFE) into the legacy jQuery UI for the demo build.
// scripts/inject-classic.mjs injects the compiled `classic-mock.js` into the top
// of each classic page's <head>, so the mock device is in place before any page
// script (jQuery, the inline pollers, …) makes a request.
import { installDemo } from './install'

installDemo()

// The legacy page renders the LCD BMP raw, which (like a real device's classic
// UI) swaps red/blue. Inject the same R/B-swap the new UI uses so the demo LCD
// shows true colours. A <style> on the persistent <head> keeps it applied across
// jQuery Mobile page swaps.
function injectLcdColorFix(): void {
  if (document.getElementById('demo-lcd-rb-svg')) return
  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.id = 'demo-lcd-rb-svg'
  svg.setAttribute('aria-hidden', 'true')
  svg.style.cssText = 'position:absolute;width:0;height:0'
  svg.innerHTML =
    '<filter id="demo-lcd-rb" color-interpolation-filters="sRGB">' +
    '<feColorMatrix type="matrix" values="0 0 1 0 0  0 1 0 0 0  1 0 0 0 0  0 0 0 1 0"/>' +
    '</filter>'
  const style = document.createElement('style')
  style.textContent = '.lcd-screen{filter:url(#demo-lcd-rb)}'
  document.head.appendChild(style)
  document.body.appendChild(svg)
}

// Float a small "demo" banner over the legacy page. Added on window load so
// jQuery Mobile has finished rearranging the DOM and won't move/hide it.
function addBanner(): void {
  if (document.getElementById('smartevse-demo-banner')) return
  const bar = document.createElement('div')
  bar.id = 'smartevse-demo-banner'
  bar.style.cssText = [
    'position:fixed',
    'left:0',
    'right:0',
    'bottom:0',
    'z-index:99999',
    'padding:6px 12px',
    'font:600 12px/1.4 system-ui,sans-serif',
    'text-align:center',
    'color:#bbf7d0',
    'background:rgba(6,20,12,0.92)',
    'border-top:1px solid rgba(74,222,128,0.4)',
  ].join(';')
  bar.innerHTML =
    'Demo — no real SmartEVSE; all values are simulated (LCD PIN 1234). ' +
    '<a href="/app.html" style="color:#86efac;text-decoration:underline">Try the new UI →</a> · ' +
    '<a href="https://github.com/fossyfox/SmartEVSE-3.5" target="_blank" rel="noopener" ' +
    'style="color:#86efac;text-decoration:underline">Source</a>'
  document.body.appendChild(bar)
}

function onReady(): void {
  injectLcdColorFix()
  addBanner()
}

if (document.readyState === 'complete') onReady()
else window.addEventListener('load', onReady)
