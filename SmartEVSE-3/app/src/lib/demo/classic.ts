// Entry point bundled (as an IIFE) into the legacy jQuery UI for the demo build.
// scripts/build-classic-demo.mjs injects the compiled `classic-mock.js` into the
// top of each classic page's <head>, so the mock device is in place before any
// page script (jQuery, the inline pollers, …) makes a request.
import { installDemo } from './install'

installDemo()

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
    'Demo — simulated SmartEVSE, no real device (LCD PIN 1234). ' +
    '<a href="/app.html" style="color:#86efac;text-decoration:underline">Try the new UI →</a> · ' +
    '<a href="https://github.com/dingo35/SmartEVSE-3.5" target="_blank" rel="noopener" ' +
    'style="color:#86efac;text-decoration:underline">Source</a>'
  document.body.appendChild(bar)
}

if (document.readyState === 'complete') addBanner()
else window.addEventListener('load', addBanner)
