import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import { router } from './router'
import './style.css'

async function bootstrap(): Promise<void> {
  // Demo build (`--mode demo`): install the in-browser mock device before the
  // app starts polling so the static deploy needs no real SmartEVSE. The import
  // is statically dropped from non-demo builds (e.g. the firmware single-file).
  if (import.meta.env.VITE_DEMO) {
    const { installDemo } = await import('./lib/demo/install')
    installDemo()
  }

  createApp(App).use(createPinia()).use(router).mount('#app')
}

void bootstrap()
